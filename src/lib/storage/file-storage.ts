import fs from "fs";
import path from "path";
import {
  FileValidationResult,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateUploadedFile,
} from "./validation";

export {
  type FileValidationResult,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateUploadedFile,
};

// Private storage directory on the server
export const PRIVATE_STORAGE_ROOT = path.join(process.cwd(), ".data", "storage", "uploads");

/**
 * Ensures private storage directory structure exists
 */
export function ensureStorageDirectories(): void {
  const dirs = [
    PRIVATE_STORAGE_ROOT,
    path.join(PRIVATE_STORAGE_ROOT, "papers"),
    path.join(PRIVATE_STORAGE_ROOT, "schemes"),
    path.join(PRIVATE_STORAGE_ROOT, "scripts"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Saves a file buffer to private storage with a collision-resistant name
 */
export async function savePrivateFile(
  buffer: Buffer,
  originalFilename: string,
  subfolder: "papers" | "schemes" | "scripts" = "scripts"
): Promise<{ relativePath: string; absolutePath: string; fileName: string; size: number }> {
  ensureStorageDirectories();

  const ext = path.extname(originalFilename).toLowerCase() || ".pdf";
  const sanitizedBase = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedBase}${ext}`;
  const targetDir = path.join(PRIVATE_STORAGE_ROOT, subfolder);
  const absolutePath = path.join(targetDir, uniqueName);

  await fs.promises.writeFile(absolutePath, buffer);

  const relativePath = path.join(subfolder, uniqueName).replace(/\\/g, "/");

  return {
    relativePath,
    absolutePath,
    fileName: uniqueName,
    size: buffer.length,
  };
}

/**
 * Retrieves a file buffer from private storage safely
 */
export async function getPrivateFile(relativePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const normalized = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
  const absolutePath = path.join(PRIVATE_STORAGE_ROOT, normalized);

  if (!absolutePath.startsWith(PRIVATE_STORAGE_ROOT)) {
    throw new Error("Access denied: path traversal detected");
  }

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const buffer = await fs.promises.readFile(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();

  let mimeType = "application/octet-stream";
  if (ext === ".pdf") mimeType = "application/pdf";
  else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  else if (ext === ".png") mimeType = "image/png";
  else if (ext === ".webp") mimeType = "image/webp";

  return { buffer, mimeType };
}

/**
 * Stages of the script processing pipeline
 */
export type PipelineStage =
  | "uploaded"
  | "preprocessed_pdf_rasterized"
  | "handwriting_extraction_staged"
  | "model_grading_completed"
  | "teacher_review_ready";

export interface PipelineProgress {
  stage: PipelineStage;
  progressPercent: number;
  message: string;
  isMock: boolean;
}
