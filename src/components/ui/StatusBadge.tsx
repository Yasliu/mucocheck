import React from "react";
import { ApprovalStatus, AssessmentStatus } from "@/lib/types";

interface StatusBadgeProps {
  status:
    | ApprovalStatus
    | AssessmentStatus
    | "ready"
    | "processing"
    | "completed"
    | "graded"
    | "uploaded"
    | "awaiting_review";
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  switch (status) {
    case "approved":
    case "completed":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EFF5F1] text-[#2A5A43] border border-[#BCD4C7] ${className}`}
        >
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#2A5A43]" />
          Approved
        </span>
      );
    case "proposed":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FEF7EC] text-[#B2762A] border border-[#F3DEC0] ${className}`}
        >
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#B2762A]" />
          AI Proposed
        </span>
      );
    case "awaiting_review":
    case "needs_review":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FDF2EE] text-[#C25B3E] border border-[#F1CDC3] ${className}`}
        >
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#C25B3E]" />
          {status === "awaiting_review" ? "Awaiting Review" : "Needs Review"}
        </span>
      );
    case "processing":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F6F4EB] text-[#7A7264] border border-[#E0D9C8] animate-pulse ${className}`}
        >
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#7A7264]" />
          Processing
        </span>
      );
    case "graded":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F4F6F8] text-[#4A5568] border border-[#CBD5E1] ${className}`}
        >
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#4A5568]" />
          Graded
        </span>
      );
    case "ready":
    case "uploaded":
    case "draft":
    default:
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F4F2EE] text-[#6E685F] border border-[#E2DDCF] ${className}`}
        >
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[#8A857D]" />
          {status === "uploaded" ? "Uploaded" : status === "ready" ? "Ready" : "Draft"}
        </span>
      );
  }
}
