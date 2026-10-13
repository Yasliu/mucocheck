import fs from "fs";
import path from "path";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  FileValidationResult,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateUploadedFile,
} from "./validation";
import { isDevAuthAllowed } from "../auth/server-auth";
import { normalizeUuid } from "../db/supabase-store";

export {
  type FileValidationResult,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateUploadedFile,
};

// Private storage directory on the server (used for local dev / fallback)
export const PRIVATE_STORAGE_ROOT = path.join(process.cwd(), ".data", "storage", "uploads");

/**
 * Ensures private storage directory structure exists for local dev
 */
export function ensureStorageDirectories(): void {
  const dirs = [
    PRIVATE_STORAGE_ROOT,
    path.join(PRIVATE_STORAGE_ROOT, "papers"),
    path.join(PRIVATE_STORAGE_ROOT, "schemes"),
    path.join(PRIVATE_STORAGE_ROOT, "scripts"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
  }
}

/**
 * Resolves the Supabase private bucket for a given category.
 * - 'scripts' -> 'scripts'
 * - 'papers' / 'schemes' -> 'reference_docs'
 */
export function getStorageBucket(subfolder: "papers" | "schemes" | "scripts"): "scripts" | "reference_docs" {
  return subfolder === "scripts" ? "scripts" : "reference_docs";
}

/**
 * Determines MIME type from file extension
 */
export function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/**
 * Saves a file buffer to private storage (Supabase Storage in production, with dev local fallback)
 */
export async function savePrivateFile(
  buffer: Buffer,
  originalFilename: string,
  subfolder: "papers" | "schemes" | "scripts" = "scripts",
  options?: {
    teacherId?: string;
    supabaseClient?: SupabaseClient | null;
  }
): Promise<{
  relativePath: string;
  storageUri: string;
  fileName: string;
  size: number;
  bucket?: string;
}> {
  const isProd = process.env.NODE_ENV === "production";
  const ext = path.extname(originalFilename).toLowerCase() || ".pdf";
  const sanitizedBase = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedBase}${ext}`;

  const teacherId = options?.teacherId || "usr-teacher-001";
  const validTeacherId = normalizeUuid(teacherId);
  const bucket = getStorageBucket(subfolder);
  const storagePath = `${validTeacherId}/${subfolder}/${uniqueName}`;
  const mimeType = getMimeTypeFromPath(originalFilename);

  // If Supabase client is available, upload directly to remote private storage bucket
  if (options?.supabaseClient) {
    const { data, error } = await options.supabaseClient.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      if (isProd) {
        throw new Error(`Production storage upload to bucket '${bucket}' failed: ${error.message}`);
      }
      // In dev mode, log and fall through to local disk
      console.warn(`[Dev Warning] Supabase upload failed (${error.message}). Falling back to local storage.`);
    } else {
      const storageUri = `supabase://${bucket}/${storagePath}`;
      return {
        relativePath: storagePath,
        storageUri,
        fileName: uniqueName,
        size: buffer.length,
        bucket,
      };
    }
  }

  // Strict guard: in production, local disk storage is forbidden
  if (isProd || !isDevAuthAllowed()) {
    throw new Error(
      "Private file storage unavailable: Authenticated Supabase storage connection is required in production."
    );
  }

  // Local development fallback
  ensureStorageDirectories();
  const targetDir = path.join(PRIVATE_STORAGE_ROOT, subfolder);
  const absolutePath = path.join(targetDir, uniqueName);
  await fs.promises.writeFile(absolutePath, buffer);
  const relativePath = path.join(subfolder, uniqueName).replace(/\\/g, "/");

  return {
    relativePath,
    storageUri: `local://${relativePath}`,
    fileName: uniqueName,
    size: buffer.length,
  };
}

/**
 * Retrieves a file buffer from private storage safely.
 * Supports Supabase Storage URIs ('supabase://bucket/path') and legacy local files.
 */
export async function getPrivateFile(
  filePath: string,
  options?: {
    teacherId?: string;
    supabaseClient?: SupabaseClient | null;
  }
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const mimeType = getMimeTypeFromPath(filePath);

  // 1. Supabase Storage URI
  if (filePath.startsWith("supabase://") && options?.supabaseClient) {
    const uriPath = filePath.replace("supabase://", "");
    const firstSlash = uriPath.indexOf("/");
    const bucket = uriPath.substring(0, firstSlash);
    const objectPath = uriPath.substring(firstSlash + 1);

    const { data, error } = await options.supabaseClient.storage
      .from(bucket)
      .download(objectPath);

    if (error || !data) {
      return null;
    }

    const arrayBuf = await data.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuf),
      mimeType,
    };
  }

  // 2. Legacy local disk file
  const cleanPath = filePath.replace(/^local:\/\//, "");
  const normalized = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, "");
  const absolutePath = path.join(PRIVATE_STORAGE_ROOT, normalized);

  if (!absolutePath.startsWith(PRIVATE_STORAGE_ROOT)) {
    throw new Error("Access denied: path traversal detected");
  }

  if (fs.existsSync(absolutePath)) {
    const buffer = await fs.promises.readFile(absolutePath);
    return { buffer, mimeType };
  }

  return null;
}

/**
 * Creates a short-lived signed URL for safe temporary preview of a private file.
 * Guarantees no public URL is ever exposed for student scripts or marking schemes.
 */
export async function getPrivateSignedUrl(
  filePath: string,
  supabaseClient: SupabaseClient,
  expiresInSeconds = 300
): Promise<string | null> {
  if (!filePath.startsWith("supabase://")) {
    return null;
  }

  const uriPath = filePath.replace("supabase://", "");
  const firstSlash = uriPath.indexOf("/");
  const bucket = uriPath.substring(0, firstSlash);
  const objectPath = uriPath.substring(firstSlash + 1);

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

/**
 * Stages of the script processing pipeline
 */
export type PipelineStage =
  | "uploaded"
  | "preprocessed_pdf_rasterized"
  | "handwriting_extraction_staged"
  | "model_grading_completed";
