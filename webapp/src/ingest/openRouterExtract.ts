import { extractJsonBlock } from "./extractionPostProcess";

/** Primary OpenRouter extraction model. 262K context on OpenRouter. */
export const OPENROUTER_EXTRACTION_MODEL = "nvidia/nemotron-3-nano-30b-a3b";

export type OpenRouterExtractionResult = {
  rawText: string;
  /** Returned only when OpenRouter includes the actual model used in its response. */
  modelUsed?: string;
};

const OPENROUTER_TIMEOUT_MS = 180_000;
const OPENROUTER_MAX_TOKENS = 16_000;

type OpenRouterChatResponse = {
  choices?: {
    finish_reason?: string;
    message?: {
      content?: unknown;
      reasoning?: unknown;
      refusal?: unknown;
    };
  }[];
  error?: { message?: string };
  model?: string;
};

/**
 * Runs extraction via OpenRouter's OpenAI-compatible API. In local dev, the
 * browser calls Vite's same-origin proxy to avoid browser CORS/preflight
 * failures. In production/static hosting, it calls OpenRouter directly.
 */
export async function runOpenRouterExtraction(
  documentText: string,
  extractionPrompt: string,
  fileName: string,
  apiKey: string,
  onProgress?: (message: string) => void
): Promise<OpenRouterExtractionResult> {
  onProgress?.("Sending to OpenRouter…");

  const userContent = `Document text to extract (read from ${fileName} by this app):\n\n${documentText}`;
  const bearerToken = apiKey.trim().replace(/^Bearer\s+/i, "");

  const compactPrompt = compactJsonPrompt(extractionPrompt);
  const first = await requestOpenRouterCompletion({
    bearerToken,
    extractionPrompt: compactPrompt,
    userContent,
    forceJson: true,
    onProgress
  });
  let rawText = extractMessageText(first.data);
  let modelUsed =
    typeof first.data.model === "string" && first.data.model.trim()
      ? first.data.model.trim()
      : undefined;

  if (!rawText.trim() || !isCompleteJsonObject(rawText)) {
    onProgress?.("OpenRouter did not return complete JSON. Retrying with stricter output rules…");
    const retry = await requestOpenRouterCompletion({
      bearerToken,
      extractionPrompt: retryJsonPrompt(extractionPrompt),
      userContent,
      forceJson: true,
      onProgress
    });
    rawText = extractMessageText(retry.data);
    modelUsed =
      typeof retry.data.model === "string" && retry.data.model.trim()
        ? retry.data.model.trim()
        : modelUsed;
  }

  if (!rawText.trim()) {
    throw new Error(openRouterEmptyMessage(first.data, modelUsed));
  }

  if (!isCompleteJsonObject(rawText)) {
    throw new Error(
      `OpenRouter returned text, but not a complete JSON object. It may have been truncated. Preview: ${previewText(rawText)}`
    );
  }

  return { rawText, modelUsed };
}

async function requestOpenRouterCompletion({
  bearerToken,
  extractionPrompt,
  userContent,
  forceJson,
  onProgress
}: {
  bearerToken: string;
  extractionPrompt: string;
  userContent: string;
  forceJson: boolean;
  onProgress?: (message: string) => void;
}): Promise<{ data: OpenRouterChatResponse }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  let response: Response;
  try {
    onProgress?.("OpenRouter accepted the request. Waiting for a model to respond…");
    response = await fetch(openRouterChatCompletionsUrl(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Metadata": "enabled"
      },
      body: JSON.stringify({
        model: OPENROUTER_EXTRACTION_MODEL,
        messages: [
          { role: "system", content: extractionPrompt },
          { role: "user", content: userContent }
        ],
        ...(forceJson ? { response_format: { type: "json_object" } } : {}),
        reasoning: {
          effort: "none",
          exclude: true
        },
        temperature: 0,
        max_tokens: OPENROUTER_MAX_TOKENS
      })
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "OpenRouter did not return a response within 3 minutes. Nemotron may be busy or the report may be too large. Try again, use Frontier AI copy-paste, or split the report."
      );
    }
    throw new Error(
      rawMessage.toLowerCase().includes("failed to fetch")
        ? "OpenRouter could not be reached. If you are running locally, restart the dev server so the OpenRouter proxy is active. Otherwise check your internet connection, VPN, or ad blocker. You can also use Frontier AI copy-paste instead."
        : `OpenRouter request could not start: ${rawMessage}`
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  onProgress?.("OpenRouter responded. Reading the extraction…");

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const providerMessage = readOpenRouterErrorMessage(body);
    throw new Error(
      providerMessage.includes("Invalid API key") || response.status === 401
        ? "OpenRouter rejected the API key. Check it at openrouter.ai/keys."
        : providerMessage
          ? `OpenRouter request failed (${response.status}): ${providerMessage}`
          : `OpenRouter request failed (${response.status}). Try again or pick another method.`
    );
  }

  return { data: await readOpenRouterSuccess(response) };
}

async function readOpenRouterSuccess(response: Response): Promise<OpenRouterChatResponse> {
  const text = await response.text();
  let data: OpenRouterChatResponse;
  try {
    data = JSON.parse(text) as OpenRouterChatResponse;
  } catch {
    throw new Error(
      `OpenRouter returned a response the app could not read as JSON: ${text.slice(0, 240)}`
    );
  }
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  return data;
}

function extractMessageText(data: OpenRouterChatResponse): string {
  const message = data.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (typeof part === "object" && part !== null && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function openRouterEmptyMessage(data: OpenRouterChatResponse, modelUsed?: string): string {
  const choice = data.choices?.[0];
  const finish = choice?.finish_reason ? ` Finish reason: ${choice.finish_reason}.` : "";
  const model = modelUsed ? ` Model: ${modelUsed}.` : "";
  const reasoning =
    typeof choice?.message?.reasoning === "string" && choice.message.reasoning.trim()
      ? " The model returned reasoning but no JSON content."
      : "";
  const refusal =
    typeof choice?.message?.refusal === "string" && choice.message.refusal.trim()
      ? ` Refusal: ${choice.message.refusal.trim().slice(0, 180)}`
      : "";
  return `OpenRouter returned an empty extraction after retrying.${model}${finish}${reasoning}${refusal} Try again, use Frontier AI copy-paste, or split the report.`;
}

function compactJsonPrompt(extractionPrompt: string): string {
  return `${extractionPrompt}

Important output rules for this automatic extraction:
- Return ONLY one complete JSON object.
- Use minified JSON with no markdown fences and no prose.
- Do not explain your reasoning.
- Keep notes under 100 characters.
- Omit fields that are missing instead of writing long explanations.
- Close every array and object. The final character must be }.`;
}

function retryJsonPrompt(extractionPrompt: string): string {
  return `${compactJsonPrompt(extractionPrompt)}

Your previous response was not complete JSON. This retry must produce a syntactically valid JSON object that starts with { and ends with }.`;
}

function isCompleteJsonObject(text: string): boolean {
  try {
    const parsed = JSON.parse(extractJsonBlock(text));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function previewText(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 360) {
    return trimmed;
  }
  return `${trimmed.slice(0, 180)} ... ${trimmed.slice(-180)}`;
}

function openRouterChatCompletionsUrl(): string {
  if (
    typeof location !== "undefined" &&
    (location.hostname === "127.0.0.1" || location.hostname === "localhost")
  ) {
    return "/openrouter/api/v1/chat/completions";
  }
  return "https://openrouter.ai/api/v1/chat/completions";
}

function readOpenRouterErrorMessage(body: string): string {
  if (!body.trim()) {
    return "";
  }
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
    const message = parsed.error?.message ?? parsed.message;
    return typeof message === "string" ? message : "";
  } catch {
    return body.slice(0, 240);
  }
}
