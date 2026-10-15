/**
 * Document Viewer State & Calculation Utilities
 * Pure, deterministic functions for page navigation, zoom scaling, and 90-degree rotations.
 */

export interface DocumentViewerState {
  currentPage: number;
  totalPages: number;
  zoomLevel: number; // percentage (e.g. 50 to 250)
  rotation: number; // degrees: 0, 90, 180, 270
  fitMode: "custom" | "width" | "page";
}

export const INITIAL_VIEWER_STATE: DocumentViewerState = {
  currentPage: 1,
  totalPages: 1,
  zoomLevel: 100,
  rotation: 0,
  fitMode: "custom",
};

export const MIN_ZOOM = 50;
export const MAX_ZOOM = 250;
export const ZOOM_STEP = 15;

export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return Math.max(1, Math.min(page, totalPages));
}

export function nextPage(currentState: DocumentViewerState): DocumentViewerState {
  const next = clampPage(currentState.currentPage + 1, currentState.totalPages);
  return { ...currentState, currentPage: next };
}

export function prevPage(currentState: DocumentViewerState): DocumentViewerState {
  const prev = clampPage(currentState.currentPage - 1, currentState.totalPages);
  return { ...currentState, currentPage: prev };
}

export function goToPage(page: number, currentState: DocumentViewerState): DocumentViewerState {
  const target = clampPage(page, currentState.totalPages);
  return { ...currentState, currentPage: target };
}

export function zoomIn(currentState: DocumentViewerState): DocumentViewerState {
  const nextZoom = Math.min(MAX_ZOOM, currentState.zoomLevel + ZOOM_STEP);
  return { ...currentState, zoomLevel: nextZoom, fitMode: "custom" };
}

export function zoomOut(currentState: DocumentViewerState): DocumentViewerState {
  const nextZoom = Math.max(MIN_ZOOM, currentState.zoomLevel - ZOOM_STEP);
  return { ...currentState, zoomLevel: nextZoom, fitMode: "custom" };
}

export function setZoom(zoom: number, currentState: DocumentViewerState): DocumentViewerState {
  const clamped = Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM));
  return { ...currentState, zoomLevel: clamped, fitMode: "custom" };
}

export function rotateClockwise(currentState: DocumentViewerState): DocumentViewerState {
  const nextRot = (currentState.rotation + 90) % 360;
  return { ...currentState, rotation: nextRot };
}

export function rotateCounterClockwise(currentState: DocumentViewerState): DocumentViewerState {
  const nextRot = (currentState.rotation + 270) % 360;
  return { ...currentState, rotation: nextRot };
}

export function resetViewerState(totalPages = 1): DocumentViewerState {
  return {
    ...INITIAL_VIEWER_STATE,
    totalPages: Math.max(1, totalPages),
  };
}

export type SupportedDocumentType = "pdf" | "image" | "unsupported";

export function detectDocumentType(mimeType?: string, fileName?: string): SupportedDocumentType {
  const lowerMime = (mimeType || "").toLowerCase();
  const lowerName = (fileName || "").toLowerCase();

  if (lowerMime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    lowerMime.startsWith("image/") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp")
  ) {
    return "image";
  }

  return "unsupported";
}
