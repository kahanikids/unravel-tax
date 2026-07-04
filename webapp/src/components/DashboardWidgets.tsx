/**
 * Dependency-free dashboard chart primitives (CLAUDE.md / ponytail: no new
 * charting libraries). Donuts are CSS conic-gradients, the variance gauge is
 * inline SVG, and the meters are plain divs. Every figure shown here is
 * computed upstream in App - these components only display it.
 */

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/** Compact Indian-notation amount for big headline numbers: 125000 -> "1.25L". */
export function formatCompactInr(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toLocaleString("en-IN", { maximumFractionDigits: 2 })}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toLocaleString("en-IN", { maximumFractionDigits: 1 })}k`;
  }
  return `${sign}₹${abs}`;
}

export type DonutSegment = {
  label: string;
  /** Signed value, shown in the legend. */
  value: number;
  color: string;
};

/**
 * CSS conic-gradient donut. Slices are sized by each segment's magnitude
 * (capital gains can be losses), with the sign kept in the legend so a loss
 * is never hidden.
 */
export function Donut({
  segments,
  centerValue,
  centerLabel,
  ariaLabel
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  ariaLabel: string;
}) {
  const active = segments.filter((segment) => Math.abs(segment.value) > 0);
  const total = active.reduce((sum, segment) => sum + Math.abs(segment.value), 0);

  let cursor = 0;
  const stops = active
    .map((segment) => {
      const start = (cursor / total) * 360;
      cursor += Math.abs(segment.value);
      const end = (cursor / total) * 360;
      return `${segment.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="donut-widget">
      <div
        className="donut"
        style={{ background: total > 0 ? `conic-gradient(${stops})` : "var(--surface-soft)" }}
        role="img"
        aria-label={ariaLabel}
      >
        <div className="donut-hole">
          <span className="donut-center-value">{centerValue}</span>
          <span className="donut-center-label">{centerLabel}</span>
        </div>
      </div>
      <ul className="donut-legend">
        {segments.map((segment) => (
          <li className="donut-legend-item" key={segment.label}>
            <span className="donut-swatch" style={{ background: segment.color }} aria-hidden="true" />
            <span className="donut-legend-label">{segment.label}</span>
            <span className={segment.value < 0 ? "donut-legend-value donut-legend-loss" : "donut-legend-value"}>
              {segment.value < 0 ? "−" : ""}
              {formatCompactInr(Math.abs(segment.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A horizontal meter filling toward a limit. Fill turns to the flag colour
 * once the limit is exceeded, so an over-limit figure reads at a glance.
 */
export function Meter({
  used,
  limit,
  caption,
  overLabel
}: {
  used: number;
  limit: number;
  caption: string;
  overLabel?: string;
}) {
  const ratio = limit > 0 ? used / limit : 0;
  const over = used > limit;
  const width = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="meter">
      <div className="meter-track" role="img" aria-label={caption}>
        <span
          className={over ? "meter-fill meter-fill-over" : "meter-fill"}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="meter-caption">{over && overLabel ? overLabel : caption}</p>
    </div>
  );
}

/**
 * A single 80C/80D/NPS deduction bar with an inline amount input. The dashboard
 * owns this planning figure the same way it owns past-filing entry; the limit
 * comes from rules/deduction-limits.json, never hardcoded here.
 */
export function DeductionBar({
  label,
  section,
  used,
  limit,
  extra = 0,
  extraNote,
  onChange
}: {
  label: string;
  section: string;
  used: number;
  limit: number;
  /** Counted toward the same ceiling but entered elsewhere (e.g. home-loan principal inside 80C): shown in the meter, never in the editable field. */
  extra?: number;
  extraNote?: string;
  onChange: (value: number) => void;
}) {
  const counted = used + Math.max(0, extra);
  const over = counted > limit;
  const width = Math.max(0, Math.min(1, limit > 0 ? counted / limit : 0)) * 100;
  return (
    <div className="deduction-bar">
      <div className="deduction-bar-head">
        <span className="deduction-bar-label">{section}</span>
        <span className="deduction-bar-limit">limit {formatCompactInr(limit)}</span>
      </div>
      <div className="meter-track" role="img" aria-label={`${label}: ${formatInr(counted)} of ${formatInr(limit)}`}>
        <span className={over ? "meter-fill meter-fill-over" : "meter-fill"} style={{ width: `${width}%` }} />
      </div>
      <label className="deduction-bar-input">
        <span className="visually-hidden">{label}</span>
        <input
          type="number"
          min={0}
          value={used}
          placeholder="₹0"
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      </label>
      {extra > 0 && extraNote ? <p className="widget-note">{extraNote}</p> : null}
    </div>
  );
}

export type ChartSeries = {
  label: string;
  color: string;
  /** One value per year, aligned to the shared `labels` array. */
  values: number[];
};

const CHART_W = 560;
const CHART_H = 200;
const PAD_X = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;

function scaleX(index: number, count: number) {
  if (count <= 1) {
    return CHART_W / 2;
  }
  return PAD_X + (index / (count - 1)) * (CHART_W - PAD_X * 2);
}

function makeScaleY(min: number, max: number) {
  const span = max - min || 1;
  const top = PAD_TOP;
  const bottom = CHART_H - PAD_BOTTOM;
  return (value: number) => bottom - ((value - min) / span) * (bottom - top);
}

/**
 * Dependency-free multi-series line chart over the years (CLAUDE.md / ponytail:
 * no charting library). The y-range always includes zero so a loss line reads
 * honestly below the baseline; each series gets a dot per year plus a legend.
 */
export function TrendChart({
  labels,
  series,
  ariaLabel,
  format = formatCompactInr
}: {
  labels: string[];
  series: ChartSeries[];
  ariaLabel: string;
  format?: (value: number) => string;
}) {
  const all = series.flatMap((line) => line.values);
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const y = makeScaleY(min, max);
  const zeroY = y(0);

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <line x1={PAD_X} y1={zeroY} x2={CHART_W - PAD_X} y2={zeroY} className="trend-axis" />
        {series.map((line) => {
          const points = line.values.map((value, index) => `${scaleX(index, labels.length)},${y(value)}`).join(" ");
          return (
            <g key={line.label}>
              {labels.length > 1 ? (
                <polyline points={points} fill="none" stroke={line.color} className="trend-line" />
              ) : null}
              {line.values.map((value, index) => (
                <circle key={index} cx={scaleX(index, labels.length)} cy={y(value)} r={4} fill={line.color} />
              ))}
            </g>
          );
        })}
        {labels.map((label, index) => (
          <text key={label} x={scaleX(index, labels.length)} y={CHART_H - 8} className="trend-x-label" textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
      <ul className="chart-legend">
        {series.map((line) => {
          const latest = line.values[line.values.length - 1] ?? 0;
          return (
            <li className="chart-legend-item" key={line.label}>
              <span className="donut-swatch" style={{ background: line.color }} aria-hidden="true" />
              <span className="chart-legend-label">{line.label}</span>
              <span className="chart-legend-value">{format(latest)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Signed vertical bar chart for the headline "tax paid or refunded" trend:
 * bars grow up from a centred zero line, green for a refund, red for tax
 * payable, so the direction reads at a glance.
 */
export function SignedBarChart({
  labels,
  values,
  ariaLabel,
  positiveLabel,
  negativeLabel,
  format = formatCompactInr
}: {
  labels: string[];
  values: number[];
  ariaLabel: string;
  positiveLabel: string;
  negativeLabel: string;
  format?: (value: number) => string;
}) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const y = makeScaleY(min, max);
  const zeroY = y(0);
  const count = labels.length;
  const slot = (CHART_W - PAD_X * 2) / Math.max(1, count);
  const barW = Math.min(48, slot * 0.6);

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <line x1={PAD_X} y1={zeroY} x2={CHART_W - PAD_X} y2={zeroY} className="trend-axis" />
        {values.map((value, index) => {
          const cx = PAD_X + slot * (index + 0.5);
          const top = value >= 0 ? y(value) : zeroY;
          const height = Math.abs(y(value) - zeroY);
          return (
            <g key={labels[index]}>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={Math.max(1, height)}
                rx={3}
                className={value >= 0 ? "signed-bar-pos" : "signed-bar-neg"}
              />
              {value !== 0 ? (
                <text
                  x={cx}
                  y={value >= 0 ? top - 5 : top + height + 12}
                  className="trend-value-label"
                  textAnchor="middle"
                >
                  {format(value)}
                </text>
              ) : null}
              <text x={cx} y={CHART_H - 8} className="trend-x-label" textAnchor="middle">
                {labels[index]}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="chart-legend">
        <li className="chart-legend-item">
          <span className="donut-swatch signed-bar-pos" aria-hidden="true" />
          <span className="chart-legend-label">{positiveLabel}</span>
        </li>
        <li className="chart-legend-item">
          <span className="donut-swatch signed-bar-neg" aria-hidden="true" />
          <span className="chart-legend-label">{negativeLabel}</span>
        </li>
      </ul>
    </div>
  );
}

/**
 * Inline-SVG semicircle gauge for the AIS/TDS variance check: the green arc is
 * the share of entered figures that match, the red remainder is mismatches.
 */
export function VarianceGauge({ matched, total }: { matched: number; total: number }) {
  const radius = 52;
  const cx = 64;
  const cy = 64;
  const length = Math.PI * radius;
  const ratio = total > 0 ? matched / total : 0;
  const path = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
  return (
    <svg className="variance-gauge" viewBox="0 0 128 76" role="img" aria-label={`${matched} of ${total} figures match your AIS entries`}>
      <path d={path} className="variance-gauge-track" />
      <path
        d={path}
        className="variance-gauge-value"
        strokeDasharray={`${ratio * length} ${length}`}
      />
      <text x={cx} y={cy - 12} className="variance-gauge-number" textAnchor="middle">
        {matched}/{total}
      </text>
      <text x={cx} y={cy + 6} className="variance-gauge-caption" textAnchor="middle">
        match
      </text>
    </svg>
  );
}
