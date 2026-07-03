import type { ExportFile } from "./exports";

/**
 * Optional convenience on top of the download flow (BUILD_PLAN.md Section 9:
 * still no server, still nothing leaves the browser). Uses the File System
 * Access API so a user can pick one folder on their own computer and have
 * submitted documents and generated exports written straight there, instead
 * of piling up in their Downloads folder. Chromium-only today - callers must
 * feature-detect with isLocalFolderSupported() and fall back to
 * downloadExport() (src/lib/exports.ts) everywhere else.
 *
 * Minimal ambient types below because the File System Access API isn't in
 * TypeScript's bundled lib.dom.d.ts.
 */

type FileSystemWritableFileStream = {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
};

type FileSystemFileHandle = {
  createWritable(): Promise<FileSystemWritableFileStream>;
};

export type LocalFolderHandle = {
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker(options?: { mode?: "read" | "readwrite"; id?: string }): Promise<LocalFolderHandle>;
};

export function isLocalFolderSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function chooseLocalFolder(): Promise<LocalFolderHandle | null> {
  if (!isLocalFolderSupported()) {
    return null;
  }
  try {
    return await (window as unknown as WindowWithDirectoryPicker).showDirectoryPicker({
      mode: "readwrite",
      id: "unravel-tax"
    });
  } catch (cause) {
    // AbortError when the user cancels the picker - not a failure.
    if (cause instanceof Error && cause.name === "AbortError") {
      return null;
    }
    throw cause;
  }
}

export async function writeFileToFolder(directory: LocalFolderHandle, filename: string, blob: Blob): Promise<void> {
  const fileHandle = await directory.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function saveExportToFolder(directory: LocalFolderHandle, file: ExportFile): Promise<void> {
  await writeFileToFolder(directory, file.filename, file.blob);
}

export async function saveDocumentCopyToFolder(
  directory: LocalFolderHandle,
  fileName: string,
  csvText: string
): Promise<void> {
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_");
  const targetName = safeName.toLowerCase().endsWith(".csv") ? safeName : `${safeName}.csv`;
  await writeFileToFolder(directory, `submitted - ${targetName}`, new Blob([csvText], { type: "text/csv;charset=utf-8" }));
}
