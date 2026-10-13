"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Filter,
  CheckCircle2,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { repository } from "@/lib/db/repo";
import {
  Assessment,
  AssessmentQuestion,
  MarkbookRow,
} from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatPercentage, formatScore } from "@/lib/utils";

export default function AssessmentMarkbookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const assessmentId = resolvedParams.id;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [rows, setRows] = useState<MarkbookRow[]>([]);
  const [stats, setStats] = useState<{
    averageScore: number | null;
    highestScore: number | null;
    lowestScore: number | null;
    approvedCount: number;
    pendingCount: number;
  }>({
    averageScore: null,
    highestScore: null,
    lowestScore: null,
    approvedCount: 0,
    pendingCount: 0,
  });

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    questionId: string;
  } | null>(null);
  const [tempCellValue, setTempCellValue] = useState<string>("");

  const loadData = () => {
    try {
      const data = repository.getMarkbook(assessmentId);
      setAssessment(data.assessment);
      setQuestions(data.questions);
      setRows(data.rows);
      setStats(data.stats);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [assessmentId]);

  const handleCellBlur = (
    resultId: string | undefined,
    questionId: string,
    studentId: string
  ) => {
    setEditingCell(null);
    if (!tempCellValue || isNaN(Number(tempCellValue))) return;

    const val = Number(tempCellValue);
    const q = questions.find((item) => item.id === questionId);
    if (!q) return;

    if (val < 0 || val > q.max_marks) {
      alert(`Score must be between 0 and ${q.max_marks}`);
      return;
    }

    if (resultId) {
      repository.updateGradingResult(resultId, {
        approved_score: val,
        status: "approved",
        edited_by_teacher: true,
      });
      loadData();
    }
  };

  const filteredRows = rows.filter((r) => {
    if (filterStatus === "all") return true;
    return r.approval_status === filterStatus;
  });

  if (!assessment) {
    return (
      <div className="py-20 text-center text-xs text-[#6E685F]">
        Loading markbook...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E8E2D5]">
        <div className="space-y-1">
          <Link
            href={`/assessments/${assessment.id}`}
            className="text-xs text-[#6E685F] hover:text-[#1C1A17] inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Assessment Overview</span>
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-2xl font-semibold text-[#1C1A17]">
              Markbook: {assessment.title}
            </h2>
          </div>
          <p className="text-xs text-[#6E685F]">
            Deterministic question matrix with instant score recalculation and CSV export.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/export-csv?assessmentId=${assessment.id}`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] text-xs font-medium text-[#1C1A17] transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#2A5A43]" />
            <span>Export CSV</span>
          </a>

          <Link
            href={`/assessments/${assessment.id}/review`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium transition-colors shadow-xs"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Grading Review</span>
          </Link>
        </div>
      </div>

      {/* Cohort Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded p-3">
          <span className="text-[#6E685F] block">Class Average</span>
          <span className="text-base font-serif font-bold text-[#1C1A17] mt-0.5 block">
            {stats.averageScore !== null ? `${stats.averageScore} / ${assessment.max_marks}` : "—"}
          </span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded p-3">
          <span className="text-[#6E685F] block">Highest Mark</span>
          <span className="text-base font-serif font-bold text-[#2A5A43] mt-0.5 block">
            {stats.highestScore !== null ? `${stats.highestScore} marks` : "—"}
          </span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded p-3">
          <span className="text-[#6E685F] block">Lowest Mark</span>
          <span className="text-base font-serif font-bold text-[#C25B3E] mt-0.5 block">
            {stats.lowestScore !== null ? `${stats.lowestScore} marks` : "—"}
          </span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded p-3">
          <span className="text-[#6E685F] block">Approved Scripts</span>
          <span className="text-base font-serif font-bold text-[#2A5A43] mt-0.5 block">
            {stats.approvedCount}
          </span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded p-3">
          <span className="text-[#6E685F] block">Pending Verification</span>
          <span className="text-base font-serif font-bold text-[#B2762A] mt-0.5 block">
            {stats.pendingCount}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-[#FFFFFF] p-3 rounded border border-[#E8E2D5] text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#8E877D]" />
          <span className="text-[#6E685F]">Filter by Approval Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#FAF8F3] border border-[#E8E2D5] rounded py-1 px-2 text-[#1C1A17]"
          >
            <option value="all">All Candidates ({rows.length})</option>
            <option value="approved">Approved Only</option>
            <option value="needs_review">Needs Review Only</option>
            <option value="proposed">AI Proposed Only</option>
          </select>
        </div>

        <span className="text-[11px] text-[#6E685F]">
          Click any mark cell to edit score directly.
        </span>
      </div>

      {/* Interactive Matrix Table */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md overflow-x-auto shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FAF8F3] border-b border-[#E8E2D5] text-[#6E685F] font-medium">
              <th className="py-3 px-3 w-20">Roll No</th>
              <th className="py-3 px-3 w-44">Student Name</th>
              {questions.map((q) => (
                <th key={q.id} className="py-3 px-3 text-center min-w-[75px]">
                  <div>Q{q.question_number}</div>
                  <div className="text-[10px] font-mono text-[#8E877D]">
                    ({q.max_marks}m)
                  </div>
                </th>
              ))}
              <th className="py-3 px-3 text-center font-bold text-[#1C1A17] min-w-[90px]">
                Raw Total
                <div className="text-[10px] font-mono text-[#8E877D]">
                  (/{assessment.max_marks})
                </div>
              </th>
              <th className="py-3 px-3 text-center font-bold text-[#1C1A17] min-w-[80px]">
                %
              </th>
              <th className="py-3 px-3 text-center min-w-[100px]">Status</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E2D5]">
            {filteredRows.map((r) => (
              <tr key={r.student.id} className="hover:bg-[#FAF8F3] transition-colors">
                <td className="py-2.5 px-3 font-mono text-[#6E685F]">
                  {r.student.roll_number}
                </td>
                <td className="py-2.5 px-3 font-medium text-[#1C1A17]">
                  {r.student.full_name}
                </td>

                {questions.map((q) => {
                  const scoreObj = r.question_scores[q.id];
                  const isEditing =
                    editingCell?.studentId === r.student.id &&
                    editingCell?.questionId === q.id;

                  const score = scoreObj
                    ? scoreObj.approved_score !== null
                      ? scoreObj.approved_score
                      : scoreObj.proposed_score
                    : null;

                  return (
                    <td
                      key={q.id}
                      onClick={() => {
                        if (scoreObj?.grading_result_id) {
                          setEditingCell({
                            studentId: r.student.id,
                            questionId: q.id,
                          });
                          setTempCellValue(score !== null ? score.toString() : "");
                        }
                      }}
                      className="py-2.5 px-3 text-center font-mono cursor-pointer hover:bg-[#F6F3EB]"
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          type="number"
                          step="0.5"
                          value={tempCellValue}
                          onChange={(e) => setTempCellValue(e.target.value)}
                          onBlur={() =>
                            handleCellBlur(
                              scoreObj?.grading_result_id,
                              q.id,
                              r.student.id
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCellBlur(
                                scoreObj?.grading_result_id,
                                q.id,
                                r.student.id
                              );
                            }
                          }}
                          className="w-12 p-0.5 text-center bg-[#FFFFFF] border border-[#2A5A43] rounded"
                        />
                      ) : (
                        <span
                          className={`${
                            scoreObj?.approved_score !== null
                              ? "font-semibold text-[#1C1A17]"
                              : scoreObj
                              ? "text-[#B2762A] italic"
                              : "text-[#8E877D]"
                          }`}
                        >
                          {formatScore(score)}
                        </span>
                      )}
                    </td>
                  );
                })}

                <td className="py-2.5 px-3 text-center font-mono font-bold text-[#1C1A17]">
                  {formatScore(r.raw_total)}
                </td>

                <td className="py-2.5 px-3 text-center font-mono font-medium text-[#2A5A43]">
                  {formatPercentage(r.percentage)}
                </td>

                <td className="py-2.5 px-3 text-center">
                  <StatusBadge status={r.approval_status} />
                </td>

                <td className="py-2.5 px-3 text-right">
                  {r.script && (
                    <Link
                      href={`/assessments/${assessment.id}/review?scriptId=${r.script.id}`}
                      className="text-xs font-medium text-[#2A5A43] hover:underline"
                    >
                      Review
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
