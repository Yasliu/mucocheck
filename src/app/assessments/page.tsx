"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Filter, ArrowRight, FileCheck2, TableProperties, Eye } from "lucide-react";
import { Assessment } from "@/lib/types";
import { repository } from "@/lib/db/repo";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAssessments() {
      try {
        const res = await fetch("/api/assessments");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.assessments)) {
            setAssessments(data.assessments);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch assessments from API:", err);
      }
      setAssessments(repository.getAssessments());
      setLoading(false);
    }

    fetchAssessments();
  }, []);

  const filtered = assessments.filter((asm) => {
    const matchesSearch =
      asm.title.toLowerCase().includes(search.toLowerCase()) ||
      asm.subject.toLowerCase().includes(search.toLowerCase()) ||
      asm.grade_level.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || asm.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E8E2D5]">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-[#1C1A17]">
            Assessments
          </h2>
          <p className="text-sm text-[#6E685F] mt-1">
            Manage examination papers, marking criteria, student scripts, and grading review queues.
          </p>
        </div>

        <Link
          href="/assessments/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-sm font-medium transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Assessment</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFFFF] p-3 rounded-md border border-[#E8E2D5]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8E877D] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, subject, grade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17] placeholder-[#8E877D] focus:outline-hidden focus:border-[#2A5A43]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#8E877D]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-[#FAF8F3] border border-[#E8E2D5] rounded py-1.5 px-2 text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
          >
            <option value="all">All Statuses</option>
            <option value="awaiting_review">Awaiting Review</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Assessment Table */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md overflow-hidden shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E8E2D5] bg-[#FAF8F3] text-[#6E685F] font-medium">
              <th className="py-3 px-4">Assessment Title</th>
              <th className="py-3 px-4">Subject & Cohort</th>
              <th className="py-3 px-4">Max Marks</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Progress</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E2D5]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#8E877D]">
                  No assessments found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((asm) => (
                <tr key={asm.id} className="hover:bg-[#FAF8F3] transition-colors">
                  <td className="py-3 px-4">
                    <Link
                      href={`/assessments/${asm.id}`}
                      className="font-medium text-[#1C1A17] hover:text-[#2A5A43] hover:underline"
                    >
                      {asm.title}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-[#6E685F]">
                    {asm.subject} • {asm.grade_level} ({asm.section})
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-[#1C1A17]">
                    {asm.max_marks}
                  </td>
                  <td className="py-3 px-4 text-[#6E685F]">{asm.date}</td>
                  <td className="py-3 px-4">
                    <div className="w-28 space-y-1">
                      <div className="flex justify-between text-[11px] text-[#6E685F]">
                        <span>
                          {asm.approved_scripts}/{asm.total_scripts}
                        </span>
                        <span>
                          {asm.total_scripts > 0
                            ? Math.round((asm.approved_scripts / asm.total_scripts) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#E8E2D5] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2A5A43] rounded-full"
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
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={asm.status} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/assessments/${asm.id}`}
                        title="Assessment Details"
                        className="p-1 text-[#6E685F] hover:text-[#1C1A17] rounded hover:bg-[#F0EBE0]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/assessments/${asm.id}/review`}
                        title="Grading Review Workspace"
                        className="p-1 text-[#B2762A] hover:text-[#8C5818] rounded hover:bg-[#FEF7EC]"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/assessments/${asm.id}/markbook`}
                        title="Markbook"
                        className="p-1 text-[#2A5A43] hover:text-[#214734] rounded hover:bg-[#EFF5F1]"
                      >
                        <TableProperties className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
