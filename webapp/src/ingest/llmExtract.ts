export type ExtractProgress = {
  phase: "loading" | "generating";
  progress: number;
  message: string;
};

let worker: Worker | null = null;

/** True when WebGPU is available — required for in-browser Llama extraction. */
export async function isWebGpuAvailable(): Promise<boolean> {
  if (!("gpu" in navigator)) {
    return false;
  }
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } }).gpu;
  if (!gpu) {
    return false;
  }
  try {
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./llmExtract.worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

/**
 * Runs Llama 3.2 3B extraction in a Web Worker so the UI stays responsive.
 * Weights download on first use (~2 GB). Only one model is loaded at a time.
 */
export function runInBrowserExtraction(
  documentText: string,
  extractionPrompt: string,
  fileName: string,
  onProgress: (progress: ExtractProgress) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const activeWorker = getWorker();

    const handleMessage = (event: MessageEvent) => {
      const message = event.data as
        | { type: "progress"; phase: ExtractProgress["phase"]; progress: number; message: string }
        | { type: "done"; rawText: string }
        | { type: "error"; message: string };

      if (message.type === "progress") {
        onProgress({
          phase: message.phase,
          progress: message.progress,
          message: message.message
        });
        return;
      }

      activeWorker.removeEventListener("message", handleMessage);

      if (message.type === "error") {
        reject(new Error(message.message));
        return;
      }

      resolve(message.rawText);
    };

    activeWorker.addEventListener("message", handleMessage);
    activeWorker.postMessage({
      type: "extract",
      extractionPrompt,
      documentText,
      fileName
    });
  });
}
