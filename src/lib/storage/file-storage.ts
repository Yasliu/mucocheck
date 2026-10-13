export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Validates uploaded script or reference documents
 */
export function validateUploadedFile(file: {
  name: string;
  size: number;
  type: string;
}): FileValidationResult {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (file.size <= 0) {
    return { valid: false, error: "File appears empty (0 bytes)" };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of 25MB`,
    };
  }

  // Normalize MIME type or check extension if mime is generic
  const ext = file.name.split(".").pop()?.toLowerCase();
  const validExts = ["pdf", "jpg", "jpeg", "png", "webp"];

  if (!ALLOWED_MIME_TYPES.includes(file.type) && (!ext || !validExts.includes(ext))) {
    return {
      valid: false,
      error: `Unsupported file format. Please upload PDF, JPEG, or PNG files only.`,
    };
  }

  return { valid: true };
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
