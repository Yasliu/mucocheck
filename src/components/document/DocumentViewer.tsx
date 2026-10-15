"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  FileText,
  AlertCircle,
  Loader2,
  Maximize2,
  FileQuestion,
  EyeOff,
  Image as ImageIcon,
} from "lucide-react";
import {
  DocumentViewerState,
  INITIAL_VIEWER_STATE,
  detectDocumentType,
  nextPage,
  prevPage,
  goToPage,
  zoomIn,
  zoomOut,
  setZoom,
  rotateClockwise,
  rotateCounterClockwise,
  resetViewerState,
} from "@/lib/document/viewer-state";

interface DocumentViewerProps {
  /** Relative path or direct authorized API URL (e.g., "/api/files/scripts/uuid.pdf") */
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
  onReassignMatch?: () => void;
  onFlagUnreadable?: () => void;
  className?: string;
}

export function DocumentViewer({
  fileUrl,
  fileName,
  mimeType,
  initialPage = 1,
  onPageChange,
  onReassignMatch,
  onFlagUnreadable,
  className = "",
}: DocumentViewerProps) {
  const [state, setState] = useState<DocumentViewerState>(() =>
    resetViewerState(1)
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const docType = detectDocumentType(mimeType, fileName || fileUrl);

  // Normalized streaming URL: ensure path goes through authorized /api/files/
  const streamUrl = React.useMemo(() => {
    if (!fileUrl) return "";
    if (fileUrl.startsWith("/api/files/")) return fileUrl;
    if (fileUrl.startsWith("supabase://")) {
      const cleanPath = fileUrl.replace(/^supabase:\/\/[^/]+\//, "");
      return `/api/files/${cleanPath}`;
    }
    const clean = fileUrl.replace(/^\/+/, "");
    return `/api/files/${clean}`;
  }, [fileUrl]);

  // Load PDF Document via pdfjs-dist
  useEffect(() => {
    let isCancelled = false;

    if (!streamUrl || docType !== "pdf") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        
        // Configure PDF.js worker
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        const loadingTask = pdfjs.getDocument({
          url: streamUrl,
          withCredentials: true,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdf;
        const total = pdf.numPages || 1;
        const startPage = Math.min(Math.max(1, initialPage), total);

        setState((prev) => ({
          ...prev,
          totalPages: total,
          currentPage: startPage,
        }));
        setLoading(false);
        if (onPageChange) onPageChange(startPage, total);
      } catch (err: any) {
        if (isCancelled) return;
        console.error("Failed to load PDF document:", err);
        setError(
          err?.message ||
            "Unable to parse or open this PDF document. The file may be corrupt or unauthorized."
        );
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {}
        pdfDocRef.current = null;
      }
    };
  }, [streamUrl, docType]);

  // Render Current Page to HTML5 Canvas
  const renderCurrentPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || docType !== "pdf") return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {}
      renderTaskRef.current = null;
    }

    try {
      setRenderingPage(true);
      const page = await pdf.getPage(state.currentPage);
      const context = canvas.getContext("2d");
      if (!context) return;

      // Base scale at 100% is 1.5 for crisp handwriting text on retina displays
      const baseScale = 1.5;
      const effectiveScale = baseScale * (state.zoomLevel / 100);
      const viewport = page.getViewport({
        scale: effectiveScale,
        rotation: state.rotation,
      });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
      setRenderingPage(false);
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Error rendering PDF page:", err);
      }
      setRenderingPage(false);
    }
  }, [state.currentPage, state.zoomLevel, state.rotation, docType]);

  useEffect(() => {
    if (docType === "pdf" && !loading && !error) {
      renderCurrentPage();
    }
  }, [renderCurrentPage, docType, loading, error]);

  // Page Navigation Handlers
  const handlePrevPage = () => {
    setState((prev) => {
      const next = prevPage(prev);
      if (onPageChange && next.currentPage !== prev.currentPage) {
        onPageChange(next.currentPage, next.totalPages);
      }
      return next;
    });
  };

  const handleNextPage = () => {
    setState((prev) => {
      const next = nextPage(prev);
      if (onPageChange && next.currentPage !== prev.currentPage) {
        onPageChange(next.currentPage, next.totalPages);
      }
      return next;
    });
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setState((prev) => {
        const next = goToPage(val, prev);
        if (onPageChange && next.currentPage !== prev.currentPage) {
          onPageChange(next.currentPage, next.totalPages);
        }
        return next;
      });
    }
  };

  return (
    <div
      className={`bg-[#FFFFFF] border border-[#E8E2D5] rounded-md flex flex-col shadow-2xs overflow-hidden ${className}`}
    >
      {/* Viewer Header & Control Bar */}
      <div className="p-2.5 bg-[#FAF8F3] border-b border-[#E8E2D5] flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Document Info */}
        <div className="flex items-center gap-2 min-w-0">
          {docType === "pdf" ? (
            <FileText className="w-4 h-4 text-[#2A5A43] shrink-0" />
          ) : (
            <ImageIcon className="w-4 h-4 text-[#2A5A43] shrink-0" />
          )}
          <span className="font-medium text-[#1C1A17] truncate max-w-[180px] sm:max-w-[240px]">
            {fileName || "Document Script"}
          </span>

          {/* Page Counter for Multi-Page PDFs */}
          {docType === "pdf" && state.totalPages > 1 && (
            <div className="flex items-center gap-1 bg-[#FFFFFF] border border-[#E8E2D5] rounded px-1.5 py-0.5 text-[11px] font-mono">
              <button
                onClick={handlePrevPage}
                disabled={state.currentPage <= 1 || loading}
                className="p-0.5 hover:bg-[#F6F3EB] rounded disabled:opacity-30"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-[#1C1A17]" />
              </button>
              <input
                type="number"
                min={1}
                max={state.totalPages}
                value={state.currentPage}
                onChange={handlePageInput}
                className="w-8 text-center bg-transparent border-0 focus:outline-hidden font-semibold text-[#1C1A17]"
              />
              <span className="text-[#8E877D]">/ {state.totalPages}</span>
              <button
                onClick={handleNextPage}
                disabled={state.currentPage >= state.totalPages || loading}
                className="p-0.5 hover:bg-[#F6F3EB] rounded disabled:opacity-30"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5 text-[#1C1A17]" />
              </button>
            </div>
          )}
        </div>

        {/* Action Controls: Zoom, Rotation, Reassign, Flag */}
        <div className="flex items-center gap-1.5">
          {onReassignMatch && (
            <button
              onClick={onReassignMatch}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-[#2A5A43] hover:bg-[#EFF5F1] rounded border border-[#BCD4C7] transition-colors"
              title="Correct question match"
            >
              <FileQuestion className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reassign Match</span>
            </button>
          )}

          {onFlagUnreadable && (
            <button
              onClick={onFlagUnreadable}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-[#C25B3E] hover:bg-[#FDF2EE] rounded border border-[#F1CDC3] transition-colors"
              title="Flag as unreadable"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Flag Unreadable</span>
            </button>
          )}

          <div className="h-3 w-px bg-[#E8E2D5] mx-1" />

          {/* Rotation Controls */}
          <button
            onClick={() => setState(rotateCounterClockwise)}
            className="p-1 text-[#6E685F] hover:text-[#1C1A17] hover:bg-[#F6F3EB] rounded"
            title="Rotate 90° counter-clockwise"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setState(rotateClockwise)}
            className="p-1 text-[#6E685F] hover:text-[#1C1A17] hover:bg-[#F6F3EB] rounded"
            title="Rotate 90° clockwise"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-[#E8E2D5] mx-1" />

          {/* Zoom Controls */}
          <button
            onClick={() => setState(zoomOut)}
            className="p-1 text-[#6E685F] hover:text-[#1C1A17] hover:bg-[#F6F3EB] rounded"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-[#6E685F] w-9 text-center">
            {state.zoomLevel}%
          </span>
          <button
            onClick={() => setState(zoomIn)}
            className="p-1 text-[#6E685F] hover:text-[#1C1A17] hover:bg-[#F6F3EB] rounded"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setState((prev) => setZoom(100, prev))}
            className="p-1 text-[#6E685F] hover:text-[#1C1A17] hover:bg-[#F6F3EB] rounded"
            title="Reset Zoom to 100%"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Document Canvas / Image Surface */}
      <div className="flex-1 p-4 bg-[#F6F3EB] overflow-auto flex items-center justify-center min-h-[540px] relative">
        {loading && (
          <div className="flex flex-col items-center gap-2 text-[#6E685F] text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-[#2A5A43]" />
            <span>Loading document pages...</span>
          </div>
        )}

        {error && (
          <div className="max-w-md p-5 bg-[#FFFFFF] border border-[#F1CDC3] rounded text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-[#C25B3E] mx-auto" />
            <p className="text-sm font-semibold text-[#1C1A17]">Document Preview Error</p>
            <p className="text-xs text-[#6E685F]">{error}</p>
            {streamUrl && (
              <a
                href={streamUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 text-xs text-[#2A5A43] hover:underline"
              >
                Open directly in new tab
              </a>
            )}
          </div>
        )}

        {/* 1. PDF Canvas Rendering */}
        {!loading && !error && docType === "pdf" && (
          <div className="flex flex-col items-center justify-center relative shadow-md rounded overflow-hidden">
            {renderingPage && (
              <div className="absolute inset-0 bg-[#FFFFFF]/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                <Loader2 className="w-5 h-5 animate-spin text-[#2A5A43]" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto bg-[#FFFFFF] border border-[#D8D2C4]"
            />
          </div>
        )}

        {/* 2. Image Document Rendering (JPEG, PNG, WebP) */}
        {!loading && !error && docType === "image" && streamUrl && (
          <div
            style={{
              transform: `scale(${state.zoomLevel / 100}) rotate(${state.rotation}deg)`,
              transformOrigin: "center center",
              transition: "transform 150ms ease-out",
            }}
            className="flex items-center justify-center shadow-md rounded overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={streamUrl}
              alt={fileName || "Student answer script page"}
              className="max-w-full max-h-[720px] object-contain bg-[#FFFFFF] border border-[#D8D2C4]"
              onError={() => setError("Failed to load image script.")}
            />
          </div>
        )}

        {/* 3. Unsupported Document Type */}
        {!loading && !error && docType === "unsupported" && (
          <div className="max-w-md p-5 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-[#B2762A] mx-auto" />
            <p className="text-sm font-semibold text-[#1C1A17]">Unsupported Format</p>
            <p className="text-xs text-[#6E685F]">
              The file {fileName ? `(${fileName})` : ""} is not a PDF or standard image. Supported formats: PDF, JPEG, PNG, WebP.
            </p>
          </div>
        )}
      </div>

      {/* Footer Status Bar with Metadata */}
      <div className="p-2 bg-[#FAF8F3] border-t border-[#E8E2D5] flex items-center justify-between text-[11px] font-sans text-[#8E877D]">
        <span>
          {docType === "pdf"
            ? `Page ${state.currentPage} of ${state.totalPages} • Scale ${state.zoomLevel}% • Rotation ${state.rotation}°`
            : `Image View • Scale ${state.zoomLevel}% • Rotation ${state.rotation}°`}
        </span>
        <span className="font-mono text-[10px]">Private Authenticated Stream</span>
      </div>
    </div>
  );
}
