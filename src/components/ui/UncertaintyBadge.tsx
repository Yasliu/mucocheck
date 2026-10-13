import React from "react";
import { UncertaintyStatus } from "@/lib/types";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

interface UncertaintyBadgeProps {
  status: UncertaintyStatus;
  confidenceScore?: number;
  className?: string;
}

export function UncertaintyBadge({
  status,
  confidenceScore,
  className = "",
}: UncertaintyBadgeProps) {
  if (status === "high_uncertainty") {
    return (
      <span
        title="Handwriting ambiguity detected. Requires teacher visual verification."
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#FDF2EE] text-[#C25B3E] border border-[#F1CDC3] ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-[#C25B3E]" />
        Handwriting Uncertainty
        {confidenceScore !== undefined && (
          <span className="opacity-75">({Math.round(confidenceScore * 100)}%)</span>
        )}
      </span>
    );
  }

  if (status === "medium_confidence") {
    return (
      <span
        title="Moderate confidence. Review recommended."
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#FEF7EC] text-[#B2762A] border border-[#F3DEC0] ${className}`}
      >
        <HelpCircle className="w-3.5 h-3.5 text-[#B2762A]" />
        Review Recommended
        {confidenceScore !== undefined && (
          <span className="opacity-75">({Math.round(confidenceScore * 100)}%)</span>
        )}
      </span>
    );
  }

  return (
    <span
      title="High confidence extraction and grading rationale."
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#EFF5F1] text-[#2A5A43] border border-[#BCD4C7] ${className}`}
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-[#2A5A43]" />
      High Confidence
      {confidenceScore !== undefined && (
        <span className="opacity-75">({Math.round(confidenceScore * 100)}%)</span>
      )}
    </span>
  );
}
