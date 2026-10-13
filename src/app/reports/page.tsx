"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Printer,
  Download,
  User,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { repository } from "@/lib/db/repo";
import { Student, ReportCardRecord } from "@/lib/types";
import { formatPercentage, formatScore } from "@/lib/utils";

export default function ReportCardsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [report, setReport] = useState<ReportCardRecord | null>(null);

  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await fetch("/api/students");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setStudents(list);
            setSelectedStudentId(list[0].id);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch students from API, using local repo", err);
      }
      const stuList = repository.getStudents();
      setStudents(stuList);
      if (stuList.length > 0) {
        setSelectedStudentId(stuList[0].id);
      }
    }
    loadStudents();
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    async function loadReport() {
      try {
        const res = await fetch(`/api/reports/${selectedStudentId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.student) {
            setReport(data);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch report from API, using local repo", err);
      }
      try {
        const rep = repository.getStudentReportCard(selectedStudentId);
        setReport(rep);
      } catch (e) {
        console.error(e);
      }
    }
    loadReport();
  }, [selectedStudentId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Student Selector (Hidden when printing) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E8E2D5]">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-[#1C1A17]">
            Report Cards
          </h2>
          <p className="text-sm text-[#6E685F] mt-1">
            Generate clean, printable official student academic evaluation sheets and downloadable PDFs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6E685F]">Select Student:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="text-xs bg-[#FFFFFF] border border-[#E8E2D5] rounded py-1.5 px-3 text-[#1C1A17]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.roll_number} — {s.full_name}
                </option>
              ))}
            </select>
          </div>

          {selectedStudentId && (
            <a
              href={`/api/reports/${selectedStudentId}/pdf`}
              download={`report-${selectedStudentId}.pdf`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] text-[#1C1A17] text-xs font-medium transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-[#2A5A43]" />
              <span>Download PDF</span>
            </a>
          )}

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report Card</span>
          </button>
        </div>
      </div>

      {/* Printable Report Card Canvas */}
      {report && (
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-8 md:p-12 max-w-3xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0 print:max-w-none text-[#1C1A17]">
          {/* Institutional Header */}
          <div className="border-b-2 border-[#1C1A17] pb-6 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#2A5A43] flex items-center justify-center text-[#FBF9F5] font-serif font-bold text-sm">
                  M
                </div>
                <h1 className="font-serif text-xl font-bold tracking-tight text-[#1C1A17]">
                  Mucono Collegiate Academy
                </h1>
              </div>
              <p className="text-xs text-[#6E685F]">
                Department of Natural Sciences & Mathematics • Official Grade Sheet
              </p>
            </div>

            <div className="text-right text-xs">
              <span className="font-mono text-[#6E685F] block">Academic Session</span>
              <strong className="text-sm font-serif">2026 – 2027</strong>
            </div>
          </div>

          {/* Student & Class Details Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-[#E8E2D5] text-xs">
            <div>
              <span className="text-[#6E685F] block">Student Name</span>
              <strong className="text-sm font-serif text-[#1C1A17] mt-0.5 block">
                {report.student.full_name}
              </strong>
            </div>

            <div>
              <span className="text-[#6E685F] block">Candidate Roll Number</span>
              <strong className="text-sm font-mono text-[#1C1A17] mt-0.5 block">
                {report.student.roll_number}
              </strong>
            </div>

            <div>
              <span className="text-[#6E685F] block">Class / Cohort</span>
              <strong className="text-sm text-[#1C1A17] mt-0.5 block">
                {report.class_group?.name || "General"} ({report.class_group?.section || "A"})
              </strong>
            </div>

            <div>
              <span className="text-[#6E685F] block">Overall Standing</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded font-mono font-bold text-xs bg-[#EFF5F1] text-[#2A5A43] border border-[#BCD4C7]">
                Grade {report.overall_grade} ({report.overall_percentage !== null ? `${report.overall_percentage}%` : "Incomplete"})
              </span>
            </div>
          </div>

          {/* Assessment Breakdown Table */}
          <div className="py-6 space-y-4">
            <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
              Examination Record & Evaluated Marks
            </h3>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1C1A17] text-[#6E685F] font-medium pb-2">
                  <th className="py-2.5">Assessment & Subject</th>
                  <th className="py-2.5 text-center">Raw Mark</th>
                  <th className="py-2.5 text-center">Max Marks</th>
                  <th className="py-2.5 text-center">Converted %</th>
                  <th className="py-2.5 text-center">Grade Band</th>
                  <th className="py-2.5 text-right">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D5]">
                {report.assessments.map((rec, i) => (
                  <tr key={i} className="hover:bg-[#FAF8F3]">
                    <td className="py-3">
                      <p className="font-medium text-[#1C1A17]">
                        {rec.assessment.title}
                      </p>
                      <p className="text-[11px] text-[#6E685F]">
                        {rec.assessment.subject} • Date: {rec.assessment.date}
                      </p>
                    </td>

                    <td className="py-3 text-center font-mono">
                      {rec.is_missing ? (
                        <span className="text-[#C25B3E] font-sans italic">
                          Absent / Pending
                        </span>
                      ) : (
                        formatScore(rec.raw_score)
                      )}
                    </td>

                    <td className="py-3 text-center font-mono text-[#6E685F]">
                      {rec.max_marks}
                    </td>

                    <td className="py-3 text-center font-mono font-medium text-[#1C1A17]">
                      {rec.is_missing ? "—" : formatPercentage(rec.percentage)}
                    </td>

                    <td className="py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${
                          rec.is_missing
                            ? "bg-[#FDF2EE] text-[#C25B3E]"
                            : "bg-[#EFF5F1] text-[#2A5A43]"
                        }`}
                      >
                        {rec.grade_band}
                      </span>
                    </td>

                    <td className="py-3 text-right text-[11px] text-[#6E685F]">
                      {rec.teacher_notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Policy & Note */}
          <div className="p-4 rounded border border-[#E8E2D5] bg-[#FAF8F3] text-xs space-y-1 my-4">
            <p className="font-medium text-[#1C1A17]">
              Deterministic Scoring Policy Notice:
            </p>
            <p className="text-[11px] text-[#6E685F] leading-relaxed">
              All raw totals, percentages, and grade band resolutions are calculated using verified deterministic arithmetic. Missing assessments are recorded as absent/pending rather than artificially coerced to zero.
            </p>
          </div>

          {/* Sign-off Signatures */}
          <div className="pt-12 grid grid-cols-2 gap-8 text-xs">
            <div className="border-t border-[#1C1A17] pt-2">
              <span className="font-semibold text-[#1C1A17] block">
                Dr. Eleanor Vance
              </span>
              <span className="text-[#6E685F] text-[11px]">
                Head of Department / Teacher Sign-off
              </span>
            </div>

            <div className="border-t border-[#1C1A17] pt-2 text-right">
              <span className="font-semibold text-[#1C1A17] block">
                Academic Registrar
              </span>
              <span className="text-[#6E685F] text-[11px]">
                Date: {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
