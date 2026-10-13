"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileCheck2,
  Users2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Sparkles,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import { Assessment, ClassGroup } from "@/lib/types";
import { repository } from "@/lib/db/repo";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function DashboardPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAssessments(repository.getAssessments());
    setClasses(repository.getClasses());
    setLoading(false);
  }, []);

  const totalStudents = classes.reduce((sum, c) => sum + (c.student_count || 0), 0);
  const awaitingReview = assessments.filter(
    (a) => a.status === "awaiting_review" || a.status === "processing"
  );
  const completed = assessments.filter((a) => a.status === "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#6E685F] text-sm">
        Loading workspace overview...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E8E2D5]">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-[#1C1A17]">
            Overview
          </h2>
          <p className="text-sm text-[#6E685F] mt-1">
            Handwritten script evaluation, question rubrics, and deterministic mark calculation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/assessments/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-sm font-medium transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Assessment</span>
          </Link>
        </div>
      </div>

      {/* Provider Status Callout */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded bg-[#FEF7EC] text-[#B2762A] shrink-0 mt-0.5 sm:mt-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[#1C1A17]">
                Grading Engine: Mock Provider Active
              </p>
              <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#FEF7EC] text-[#B2762A] border border-[#F3DEC0] font-mono">
                SIMULATION
              </span>
            </div>
            <p className="text-xs text-[#6E685F] mt-0.5">
              Nebius Token Factory account is awaiting team review. Deterministic evaluator returns sample handwriting evaluations with full rubric checkpoints.
            </p>
          </div>
        </div>

        <Link
          href="/settings"
          className="text-xs font-medium text-[#2A5A43] hover:text-[#214734] shrink-0 underline underline-offset-2"
        >
          Manage integration &rarr;
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#6E685F] text-xs font-medium">
            <span>Awaiting Review</span>
            <Clock className="w-4 h-4 text-[#B2762A]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-[#1C1A17]">
              {awaitingReview.length}
            </span>
            <span className="text-xs text-[#6E685F]">assessments</span>
          </div>
          <p className="text-[11px] text-[#8E877D] mt-1">
            Teacher sign-off required
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#6E685F] text-xs font-medium">
            <span>Completed Assessments</span>
            <CheckCircle2 className="w-4 h-4 text-[#2A5A43]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-[#1C1A17]">
              {completed.length}
            </span>
            <span className="text-xs text-[#6E685F]">finalized</span>
          </div>
          <p className="text-[11px] text-[#8E877D] mt-1">
            All scripts verified & approved
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#6E685F] text-xs font-medium">
            <span>Active Classes</span>
            <BookOpen className="w-4 h-4 text-[#2A5A43]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-[#1C1A17]">
              {classes.length}
            </span>
            <span className="text-xs text-[#6E685F]">cohorts</span>
          </div>
          <p className="text-[11px] text-[#8E877D] mt-1">
            Natural Sciences & Chem
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#6E685F] text-xs font-medium">
            <span>Enrolled Students</span>
            <Users2 className="w-4 h-4 text-[#6E685F]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-[#1C1A17]">
              {totalStudents}
            </span>
            <span className="text-xs text-[#6E685F]">students</span>
          </div>
          <p className="text-[11px] text-[#8E877D] mt-1">
            Across active sections
          </p>
        </div>
      </div>

      {/* Main Grid: Review Queue & Recent Assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Assessments */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
              Recent Assessments
            </h3>
            <Link
              href="/assessments"
              className="text-xs font-medium text-[#2A5A43] hover:text-[#214734] flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {assessments.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-dashed border-[#D2CAB9] rounded-md p-8 text-center space-y-3">
              <ClipboardList className="w-8 h-8 text-[#8E877D] mx-auto" />
              <h4 className="text-sm font-medium text-[#1C1A17]">
                No assessments created yet
              </h4>
              <p className="text-xs text-[#6E685F] max-w-sm mx-auto">
                Set up your first examination with a question paper, marking rubric, and student answer scripts.
              </p>
              <Link
                href="/assessments/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2A5A43] text-[#FBF9F5] text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Assessment</span>
              </Link>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md divide-y divide-[#E8E2D5] overflow-hidden shadow-2xs">
              {assessments.map((asm) => (
                <div
                  key={asm.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F3] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/assessments/${asm.id}`}
                        className="text-sm font-medium text-[#1C1A17] hover:text-[#2A5A43] transition-colors"
                      >
                        {asm.title}
                      </Link>
                      <StatusBadge status={asm.status} />
                    </div>
                    <div className="text-xs text-[#6E685F] flex flex-wrap items-center gap-3">
                      <span>{asm.subject}</span>
                      <span>•</span>
                      <span>
                        {asm.grade_level} (Sec {asm.section})
                      </span>
                      <span>•</span>
                      <span>Max: {asm.max_marks} marks</span>
                      <span>•</span>
                      <span>Date: {asm.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-[#1C1A17]">
                        {asm.approved_scripts}/{asm.total_scripts} Approved
                      </p>
                      <div className="w-24 bg-[#E8E2D5] h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-[#2A5A43] h-full rounded-full transition-all"
                          style={{
                            width: `${
                              asm.total_scripts > 0
                                ? (asm.approved_scripts / asm.total_scripts) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <Link
                      href={`/assessments/${asm.id}/review`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#F6F3EB] text-[#1C1A17] transition-colors"
                    >
                      <span>Review</span>
                      <ArrowRight className="w-3 h-3 text-[#6E685F]" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Action Queue & Class Summary */}
        <div className="space-y-6">
          {/* Action Queue */}
          <div className="space-y-3">
            <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
              Action Queue
            </h3>

            <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4 space-y-3 shadow-2xs">
              <div className="flex items-start gap-2.5 pb-3 border-b border-[#E8E2D5]">
                <AlertTriangle className="w-4 h-4 text-[#C25B3E] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-[#1C1A17]">
                    Handwriting Uncertainty Flag
                  </h4>
                  <p className="text-xs text-[#6E685F] mt-0.5">
                    Callum O&apos;Connor (BIO-103) has smudged subscript on Q1 requiring visual check.
                  </p>
                  <Link
                    href="/assessments/asm-bio-midterm/review"
                    className="inline-block mt-2 text-xs font-medium text-[#C25B3E] hover:underline"
                  >
                    Inspect script &rarr;
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#2A5A43] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-[#1C1A17]">
                    Markbook Ready
                  </h4>
                  <p className="text-xs text-[#6E685F] mt-0.5">
                    Cellular Respiration Midterm has 3 scripts ready for final batch sign-off.
                  </p>
                  <Link
                    href="/assessments/asm-bio-midterm/markbook"
                    className="inline-block mt-2 text-xs font-medium text-[#2A5A43] hover:underline"
                  >
                    Open Markbook &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Classes Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
                Active Cohorts
              </h3>
              <Link
                href="/classes"
                className="text-xs font-medium text-[#2A5A43] hover:text-[#214734]"
              >
                Manage
              </Link>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md divide-y divide-[#E8E2D5] overflow-hidden shadow-2xs">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-medium text-[#1C1A17]">{cls.name}</p>
                    <p className="text-[#6E685F]">
                      Section {cls.section} • {cls.academic_year}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#F6F3EB] text-[#6E685F] font-mono">
                    {cls.student_count || 0} students
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
