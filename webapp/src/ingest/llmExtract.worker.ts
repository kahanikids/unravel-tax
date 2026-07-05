/// <reference lib="webworker" />
import { CreateMLCEngine, type MLCEngineInterface } from "@mlc-ai/web-llm";

const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

type ExtractMessage = {
  type: "extract";
  extractionPrompt: string;
  documentText: string;
  fileName: string;
};

type WorkerOutMessage =
  | { type: "progress"; phase: "loading" | "generating"; progress: number; message: string }
  | { type: "done"; rawText: string }
  | { type: "error"; message: string };

let engine: MLCEngineInterface | null = null;

self.onmessage = async (event: MessageEvent<ExtractMessage>) => {
  if (event.data.type !== "extract") {
    return;
  }

  const post = (message: WorkerOutMessage) => {
    self.postMessage(message);
  };

  try {
    if (!engine) {
      engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          post({
            type: "progress",
            phase: "loading",
            progress: report.progress,
            message: report.text
          });
        }
      });
    }

    post({
      type: "progress",
      phase: "generating",
      progress: 0,
      message: "Reading your document…"
    });

    const userContent = `Document text to extract (read from ${event.data.fileName} by this app):\n\n${event.data.documentText}`;

    const reply = await engine.chat.completions.create({
      messages: [
        { role: "system", content: event.data.extractionPrompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.1,
      max_tokens: 1200
    });

    post({ type: "done", rawText: reply.choices[0]?.message?.content ?? "" });
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
