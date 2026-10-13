"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TableProperties, ArrowRight, Download, Filter } from "lucide-react";
import { repository } from "@/lib/db/repo";
import { Assessment } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function ResultsHubPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    setAssessments(repository.getAssessments());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E8E2D5]">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-[#1C1A17]">
            Results & Markbooks
          </h2>
          <p className="text-sm text-[#6E685F] mt-1">
            Access question matrices, edit approved marks, and export verified grades to CSV.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assessments.map((asm) => (
          <div
            key={asm.id}
            className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-5 space-y-4 hover:border-[#BCD4C7] transition-all shadow-2xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
                  {asm.title}
                </h3>
                <p className="text-xs text-[#6E685F] mt-0.5">
                  {asm.subject} • {asm.grade_level} ({asm.section}) • Date: {asm.date}
                </p>
              </div>
              <StatusBadge status={asm.status} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs py-2 border-y border-[#E8E2D5] bg-[#FAF8F3] rounded px-3">
              <div>
                <span className="text-[#6E685F] block text-[11px]">Max Marks</span>
                <span className="font-mono font-medium text-[#1C1A17]">{asm.max_marks}</span>
              </div>
              <div>
                <span className="text-[#6E685F] block text-[11px]">Scripts Graded</span>
                <span className="font-mono font-medium text-[#1C1A17]">{asm.graded_scripts}/{asm.total_scripts}</span>
              </div>
              <div>
                <span className="text-[#6E685F] block text-[11px]">Approved</span>
                <span className="font-mono font-medium text-[#2A5A43]">{asm.approved_scripts}/{asm.total_scripts}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href={`/api/export-csv?assessmentId=${asm.id}`}
                download
                className="inline-flex items-center gap-1.5 text-xs text-[#6E685F] hover:text-[#1C1A17]"
              >
                <Download className="w-3.5 h-3.5 text-[#2A5A43]" />
                <span>Export CSV</span>
              </a>

              <Link
                href={`/assessments/${asm.id}/markbook`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium transition-colors"
              >
                <span>Open Markbook</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
