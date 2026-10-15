"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  FileCheck2,
  TableProperties,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  Layers,
  Check,
} from "lucide-react";
import { repository } from "@/lib/db/repo";
import { Assessment, AssessmentQuestion, StudentScript } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const assessmentId = resolvedParams.id;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [scripts, setScripts] = useState<StudentScript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAssessmentDetail() {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.assessment) {
            setAssessment(data.assessment);
            setQuestions(data.questions || []);
            setScripts(data.scripts || []);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch assessment detail from API:", err);
      }

      const asm = repository.getAssessment(assessmentId);
      if (asm) {
        setAssessment(asm);
        setQuestions(repository.getQuestions(assessmentId));
        setScripts(repository.getScripts(assessmentId));
      }
      setLoading(false);
    }

    loadAssessmentDetail();
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-[#6E685F]">
        Loading assessment details...
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-sm text-[#1C1A17] font-medium">Assessment not found</p>
        <Link
          href="/assessments"
          className="text-xs text-[#2A5A43] hover:underline"
        >
          &larr; Back to Assessments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E8E2D5]">
        <div className="space-y-1">
          <Link
            href="/assessments"
            className="text-xs text-[#6E685F] hover:text-[#1C1A17] inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Assessments</span>
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-2xl font-semibold text-[#1C1A17]">
              {assessment.title}
            </h2>
            <StatusBadge status={assessment.status} />
          </div>
          <p className="text-xs text-[#6E685F]">
            {assessment.subject} • {assessment.grade_level} (Section {assessment.section}) • Max: {assessment.max_marks} marks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/assessments/${assessment.id}/review`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium transition-colors shadow-xs"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Grading Review Workspace</span>
          </Link>
          <Link
            href={`/assessments/${assessment.id}/markbook`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] text-xs font-medium text-[#1C1A17] transition-colors"
          >
            <TableProperties className="w-3.5 h-3.5 text-[#6E685F]" />
            <span>Markbook</span>
          </Link>
        </div>
      </div>

      {/* Metadata Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4">
          <span className="text-[#6E685F] block">Assessment Date</span>
          <div className="mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2A5A43]" />
            <span className="font-semibold text-sm text-[#1C1A17]">
              {assessment.date}
            </span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4">
          <span className="text-[#6E685F] block">Maximum Score</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-serif font-bold text-[#1C1A17]">
              {assessment.max_marks}
            </span>
            <span className="text-[#6E685F]">marks</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4">
          <span className="text-[#6E685F] block">Questions Configured</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-serif font-bold text-[#1C1A17]">
              {questions.length}
            </span>
            <span className="text-[#6E685F]">rubric items</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4">
          <span className="text-[#6E685F] block">Verification Progress</span>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1C1A17]">
              {assessment.approved_scripts}/{scripts.length} Scripts
            </span>
            <span className="font-mono text-[#2A5A43]">
              {scripts.length > 0
                ? Math.round((assessment.approved_scripts / scripts.length) * 100)
                : 0}
              %
            </span>
          </div>
        </div>
      </div>

      {/* Reference Documents */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 space-y-3">
        <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
          Reference Documents
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded border border-[#E8E2D5] bg-[#FAF8F3] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-[#2A5A43]" />
              <div>
                <p className="font-medium text-[#1C1A17]">
                  {assessment.question_paper_name || "Question Paper"}
                </p>
                <p className="text-[11px] text-[#6E685F]">
                  Master examination paper
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] bg-[#EFF5F1] text-[#2A5A43] font-mono">
              Ready
            </span>
          </div>

          <div className="p-3 rounded border border-[#E8E2D5] bg-[#FAF8F3] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileCheck2 className="w-4 h-4 text-[#B2762A]" />
              <div>
                <p className="font-medium text-[#1C1A17]">
                  {assessment.marking_scheme_name || "Marking Scheme"}
                </p>
                <p className="text-[11px] text-[#6E685F]">
                  Official grading criteria
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] bg-[#EFF5F1] text-[#2A5A43] font-mono">
              Ready
            </span>
          </div>
        </div>
      </div>

      {/* Question Rubric Breakdown */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 space-y-3">
        <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
          Configured Questions & Criteria
        </h3>
        {questions.length === 0 ? (
          <div className="p-4 rounded border border-dashed border-[#D2CAB9] bg-[#FAF8F3] text-xs text-[#6E685F]">
            No individual questions defined. Grading references the uploaded Question Paper and Marking Scheme directly against the overall maximum of {assessment.max_marks} marks.
          </div>
        ) : (
          <div className="divide-y divide-[#E8E2D5] border border-[#E8E2D5] rounded-md overflow-hidden text-xs">
            {questions.map((q) => (
              <div key={q.id} className="p-3.5 space-y-1.5 hover:bg-[#FAF8F3]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1C1A17]">
                    Question {q.question_number} ({q.max_marks} marks)
                  </span>
                  <span className="text-[#6E685F] text-[11px]">
                    {q.rubric_criteria.length} criteria defined
                  </span>
                </div>
                <p className="text-[#1C1A17]">{q.question_text}</p>
                {q.rubric_criteria.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {q.rubric_criteria.map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 bg-[#F6F3EB] text-[#6E685F] rounded text-[11px]"
                      >
                        {c.criterion} ({c.marks}m)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student Answer Scripts Table */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
            Student Answer Scripts ({scripts.length})
          </h3>
          {scripts.length > 0 && (
            <Link
              href={`/assessments/${assessment.id}/review`}
              className="text-xs font-medium text-[#2A5A43] hover:underline"
            >
              Open in review workspace &rarr;
            </Link>
          )}
        </div>

        <div className="border border-[#E8E2D5] rounded-md overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF8F3] border-b border-[#E8E2D5] text-[#6E685F] font-medium">
                <th className="py-2.5 px-3">Roll No</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Script File</th>
                <th className="py-2.5 px-3">Pages</th>
                <th className="py-2.5 px-3">Score</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2D5]">
              {scripts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#8E877D] text-xs">
                    No student scripts attached yet.
                  </td>
                </tr>
              ) : (
                scripts.map((scr) => (
                  <tr key={scr.id} className="hover:bg-[#FAF8F3]">
                    <td className="py-2.5 px-3 font-mono text-[#6E685F]">
                      {scr.roll_number}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#1C1A17]">
                      {scr.student_name}
                    </td>
                    <td className="py-2.5 px-3 text-[#6E685F]">{scr.file_name}</td>
                    <td className="py-2.5 px-3 text-[#6E685F]">{scr.page_count}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-[#1C1A17]">
                      {scr.total_score !== null ? `${scr.total_score} / ${assessment.max_marks}` : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={scr.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/assessments/${assessment.id}/review?scriptId=${scr.id}`}
                        className="inline-flex items-center gap-1 text-[#2A5A43] hover:text-[#214734] font-medium"
                      >
                        <span>Review</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
