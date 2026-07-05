import { EXTRACTION_METHOD_OPTIONS, type ExtractionMethodOption } from "../lib/copy";
import type { ExtractionMethod } from "../lib/extractionPrefs";

export function ExtractionMethodModal({
  onChoose
}: {
  onChoose: (method: ExtractionMethod) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div
        className="modal-card modal-card-wide"
        role="dialog"
        aria-labelledby="extraction-method-title"
      >
        <h3 id="extraction-method-title">How do you want to extract this document?</h3>
        <p className="paste-steps">
          PDFs and free-form text need LLM Options to read the numbers because reports are not
          standardised. Pick one approach. You can change it later.
        </p>
        <div className="extraction-method-grid">
          {EXTRACTION_METHOD_OPTIONS.map((option: ExtractionMethodOption) => (
            <article className="extraction-method-card" key={option.id}>
              <h4>{option.label}</h4>
              <div className="extraction-method-columns">
                <div>
                  <span className="extraction-method-column-label">Takes</span>
                  <p>{option.takes}</p>
                </div>
                <div>
                  <span className="extraction-method-column-label">Gives</span>
                  <p>{option.gives}</p>
                </div>
              </div>
              <dl className="extraction-method-facts">
                <div>
                  <dt>Accuracy</dt>
                  <dd>{option.accuracy}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{option.time}</dd>
                </div>
                <div>
                  <dt>Effort</dt>
                  <dd>{option.effort}</dd>
                </div>
                <div>
                  <dt>Data</dt>
                  <dd>{option.data}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="primary-button extraction-method-pick"
                onClick={() => onChoose(option.id)}
              >
                Use This
              </button>
            </article>
          ))}
        </div>
        <p className="extraction-method-note">
          Llama score is from Meta's external benchmark, not our report extraction test. Review
          every row.
        </p>
      </div>
    </div>
  );
}
