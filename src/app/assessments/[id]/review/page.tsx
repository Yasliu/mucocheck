"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Sparkles,
  FileText,
  User,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Save,
  CheckCircle2,
  Lock,
  History,
  RotateCcw,
  X,
  FileQuestion,
  EyeOff,
  ThumbsDown,
} from "lucide-react";
import { repository } from "@/lib/db/repo";
import {
  Assessment,
  AssessmentQuestion,
  AuditRecord,
  GradingResult,
  StudentScript,
} from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UncertaintyBadge } from "@/components/ui/UncertaintyBadge";
import { validateScoreBounds } from "@/lib/scoring/deterministic-calculator";
import { DocumentViewer } from "@/components/document/DocumentViewer";

function ReviewWorkspaceContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const assessmentId = resolvedParams.id;
  const searchParams = useSearchParams();
  const initialScriptId = searchParams.get("scriptId");

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [scripts, setScripts] = useState<StudentScript[]>([]);
  const [currentScriptIndex, setCurrentScriptIndex] = useState<number>(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [results, setResults] = useState<GradingResult[]>([]);

  // Editing state for current question
  const [teacherScore, setTeacherScore] = useState<number | string>("");
  const [teacherFeedback, setTeacherFeedback] = useState<string>("");
  const [changeReason, setChangeReason] = useState<string>("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Modals for audit operations
  const [showUnreadableDialog, setShowUnreadableDialog] = useState(false);
  const [unreadableNote, setUnreadableNote] = useState("Handwriting is smudged/indecipherable in key terms");
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [newMatchQuestionId, setNewMatchQuestionId] = useState("");
  const [matchReason, setMatchReason] = useState("Candidate answered out of sequence");
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);

  useEffect(() => {
    // Fetch from server API with repository fallback
    async function init() {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}`);
        if (res.ok) {
          const data = await res.json();
          setAssessment(data.assessment);
          setQuestions(data.questions);
          setScripts(data.scripts);
          setResults(data.results);
          if (data.questions.length > 0) {
            setSelectedQuestionId(data.questions[0].id);
          }
          if (initialScriptId) {
            const idx = data.scripts.findIndex((s: StudentScript) => s.id === initialScriptId);
            if (idx !== -1) setCurrentScriptIndex(idx);
          }
          return;
        }
      } catch (err) {
        console.warn("API fetch error, falling back to repository:", err);
      }

      // Fallback
      const asm = repository.getAssessment(assessmentId);
      if (!asm) return;
      setAssessment(asm);
      const qList = repository.getQuestions(assessmentId);
      setQuestions(qList);
      if (qList.length > 0) setSelectedQuestionId(qList[0].id);
      const scrList = repository.getScripts(assessmentId);
      setScripts(scrList);
      if (initialScriptId) {
        const idx = scrList.findIndex((s) => s.id === initialScriptId);
        if (idx !== -1) setCurrentScriptIndex(idx);
      }
      setResults(repository.getGradingResults(assessmentId));
    }

    init();
  }, [assessmentId, initialScriptId]);

  const currentScript = scripts[currentScriptIndex];
  const currentQuestion = questions.find((q) => q.id === selectedQuestionId);
  const currentResult = results.find(
    (r) =>
      r.script_id === currentScript?.id && r.question_id === selectedQuestionId
  );

  // Sync inputs when switching questions or students
  useEffect(() => {
    if (currentResult) {
      setTeacherScore(
        currentResult.approved_score !== null
          ? currentResult.approved_score
          : currentResult.proposed_score
      );
      setTeacherFeedback(currentResult.feedback || "");
      setChangeReason("");
      setErrorMsg("");
      setSaveSuccessMsg("");
    }
  }, [currentResult]);

  useEffect(() => {
    if (questions.length === 0 && currentScript) {
      setTeacherScore(currentScript.total_score !== null ? currentScript.total_score : "");
      setTeacherFeedback("");
      setErrorMsg("");
      setSaveSuccessMsg("");
    }
  }, [currentScript, questions.length]);

  const handleSaveWholeScriptScore = async () => {
    if (!currentScript || !assessment) return;
    const numScore = Number(teacherScore);
    if (isNaN(numScore) || numScore < 0 || numScore > assessment.max_marks) {
      setErrorMsg(`Score must be between 0 and ${assessment.max_marks} marks.`);
      return;
    }
    setErrorMsg("");
    try {
      await fetch("/api/results/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_script",
          scriptId: currentScript.id,
          finalScore: numScore,
          teacherName: "Dr. Eleanor Vance",
        }),
      });

      repository.approveAllResultsForScript(currentScript.id, numScore);

      // Re-fetch state
      const res = await fetch(`/api/assessments/${assessmentId}`);
      if (res.ok) {
        const d = await res.json();
        setAssessment(d.assessment);
        setScripts(d.scripts);
        setResults(d.results);
      }

      setSaveSuccessMsg("Student score approved and recorded successfully!");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    } catch {
      setErrorMsg("Failed to save student score");
    }
  };

  const handleSaveAndApprove = async (markAsApproved = true) => {
    if (!currentResult || !currentQuestion) return;

    const numScore = Number(teacherScore);
    const validation = validateScoreBounds(numScore, currentQuestion.max_marks);
    if (!validation.valid) {
      setErrorMsg(validation.error || "Invalid score");
      return;
    }

    const isScoreChanged =
      currentResult.approved_score !== null
        ? currentResult.approved_score !== numScore
        : currentResult.proposed_score !== numScore;

    const reasonToRecord =
      changeReason.trim() ||
      (isScoreChanged ? "Teacher modified proposed mark" : markAsApproved ? "Teacher verified proposed mark" : "Flagged for teacher review");

    try {
      // 1. Send update to server API
      const response = await fetch(`/api/results/${currentResult.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved_score: numScore,
          feedback: teacherFeedback,
          status: markAsApproved ? "approved" : "needs_review",
          edited_by_teacher: true,
          reason: reasonToRecord,
          teacher_name: "Dr. Eleanor Vance",
        }),
      });

      let updatedResult: GradingResult;
      if (response.ok) {
        const resData = await response.json();
        updatedResult = resData.result;
      } else {
        // Local repository fallback
        updatedResult = repository.updateGradingResult(currentResult.id, {
          approved_score: numScore,
          feedback: teacherFeedback,
          status: markAsApproved ? "approved" : "needs_review",
          edited_by_teacher: true,
        });
      }

      // Update state
      setResults((prev) =>
        prev.map((r) => (r.id === updatedResult.id ? updatedResult : r))
      );

      // Re-fetch assessment status
      const asmRes = await fetch(`/api/assessments/${assessmentId}`);
      if (asmRes.ok) {
        const d = await asmRes.json();
        setAssessment(d.assessment);
        setScripts(d.scripts);
      }

      setSaveSuccessMsg(
        markAsApproved ? "Score approved and saved to audit trail." : "Flagged for further review."
      );
      setChangeReason("");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFlagUnreadableConfirm = async () => {
    if (!currentResult) return;
    try {
      const response = await fetch("/api/results/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "flag_unreadable",
          resultId: currentResult.id,
          reason: unreadableNote,
          teacherName: "Dr. Eleanor Vance",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults((prev) =>
          prev.map((r) => (r.id === data.result.id ? data.result : r))
        );
      } else {
        const fallback = repository.updateGradingResult(currentResult.id, {
          status: "needs_review",
          feedback: `Flagged as unreadable: ${unreadableNote}`,
        });
        setResults((prev) => prev.map((r) => (r.id === fallback.id ? fallback : r)));
      }

      setShowUnreadableDialog(false);
      setSaveSuccessMsg("Answer flagged as unreadable with audit reason.");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    } catch (err) {
      alert("Error flagging unreadable answer");
    }
  };

  const handleCorrectMatchConfirm = async () => {
    if (!currentResult || !newMatchQuestionId) return;
    try {
      const response = await fetch("/api/results/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct_match",
          resultId: currentResult.id,
          newQuestionId: newMatchQuestionId,
          reason: matchReason,
          teacherName: "Dr. Eleanor Vance",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults((prev) =>
          prev.map((r) => (r.id === data.result.id ? data.result : r))
        );
        setSelectedQuestionId(newMatchQuestionId);
      }

      setShowMatchDialog(false);
      setSaveSuccessMsg("Question match successfully corrected.");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    } catch (err) {
      alert("Error correcting question match");
    }
  };

  const handleRejectProposal = async () => {
    if (!currentResult) return;
    const reason = prompt("Enter rationale for rejecting this AI grading proposal:");
    if (!reason) return;

    try {
      const response = await fetch("/api/results/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_proposal",
          resultId: currentResult.id,
          reason,
          teacherName: "Dr. Eleanor Vance",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults((prev) =>
          prev.map((r) => (r.id === data.result.id ? data.result : r))
        );
      }

      setSaveSuccessMsg("AI proposal rejected and flagged for teacher remark.");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    } catch (err) {
      alert("Error rejecting proposal");
    }
  };

  const handleApproveAllForScript = async () => {
    if (!currentScript) return;
    try {
      await fetch("/api/results/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_script",
          scriptId: currentScript.id,
          teacherName: "Dr. Eleanor Vance",
        }),
      });

      repository.approveAllResultsForScript(currentScript.id);

      // Re-fetch state
      const res = await fetch(`/api/assessments/${assessmentId}`);
      if (res.ok) {
        const d = await res.json();
        setAssessment(d.assessment);
        setScripts(d.scripts);
        setResults(d.results);
      }

      setSaveSuccessMsg("All question results for this script have been verified and approved!");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    } catch (err) {
      alert("Failed to approve script");
    }
  };

  if (!assessment || scripts.length === 0) {
    return (
      <div className="py-20 text-center space-y-3 text-xs">
        <p className="text-[#1C1A17] font-medium">No scripts available to review</p>
        <Link
          href={`/assessments/${assessmentId}`}
          className="text-[#2A5A43] hover:underline"
        >
          &larr; Back to Assessment Details
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Review Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E8E2D5]">
        <div className="flex items-center gap-3">
          <Link
            href={`/assessments/${assessment.id}`}
            className="p-1.5 rounded text-[#6E685F] hover:text-[#1C1A17] hover:bg-[#F6F3EB]"
            title="Back to Assessment"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-semibold text-[#1C1A17]">
                Grading Review Workspace
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#FEF7EC] text-[#B2762A] border border-[#F3DEC0]">
                MOCK PROVIDER
              </span>
            </div>
            <p className="text-xs text-[#6E685F]">
              {assessment.title} • {currentScript?.student_name} ({currentScript?.roll_number})
            </p>
          </div>
        </div>

        {/* Student Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentScriptIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentScriptIndex === 0}
            className="p-1.5 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] disabled:opacity-40 text-xs text-[#1C1A17]"
            title="Previous Student"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-[#6E685F] px-1 font-mono">
            Student {currentScriptIndex + 1} of {scripts.length}
          </span>
          <button
            onClick={() =>
              setCurrentScriptIndex((prev) =>
                Math.min(scripts.length - 1, prev + 1)
              )
            }
            disabled={currentScriptIndex === scripts.length - 1}
            className="p-1.5 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] disabled:opacity-40 text-xs text-[#1C1A17]"
            title="Next Student"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleApproveAllForScript}
            className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#EFF5F1] hover:bg-[#BCD4C7] text-[#2A5A43] border border-[#BCD4C7] text-xs font-medium transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approve Entire Script</span>
          </button>
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[680px]">
        {/* Left Side: Real Multi-Page Script Document Viewer (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <DocumentViewer
            fileUrl={currentScript?.file_path}
            fileName={currentScript?.file_name}
            mimeType={currentScript?.mime_type}
            initialPage={currentQuestion?.question_number || 1}
            onReassignMatch={() => {
              setNewMatchQuestionId(selectedQuestionId);
              setShowMatchDialog(true);
            }}
            onFlagUnreadable={() => setShowUnreadableDialog(true)}
            className="flex-1 min-h-[580px]"
          />

          {/* Context Card: Extracted Content & Alternative Method Alerts */}
          {currentResult && (
            <div className="p-3 bg-[#FAF8F3] border border-[#E8E2D5] rounded-md text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1C1A17]">
                  Question {currentQuestion?.question_number} Inspection Note:
                </span>
                {currentResult.alternative_method_detected && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#FEF7EC] text-[#B2762A] font-medium border border-[#F3DEC0]">
                    Valid Alternative Method
                  </span>
                )}
              </div>

              {currentResult.answer_extracted_text && (
                <p className="font-serif italic text-xs leading-relaxed text-[#4A453E] bg-[#FFFFFF] p-2.5 rounded border border-[#E8E2D5]">
                  &ldquo;{currentResult.answer_extracted_text}&rdquo;
                </p>
              )}

              {currentResult.uncertainty_status === "high_uncertainty" && (
                <div className="p-2 rounded bg-[#FDF2EE] border border-[#F1CDC3] text-[#C25B3E] flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ambiguous Handwriting:</strong>{" "}
                    {currentResult.unreadable_reason || "Unclear strokes require teacher verification."}
                  </span>
                </div>
              )}

              {currentResult.is_unmatched && (
                <div className="p-2 rounded bg-[#FEF7EC] border border-[#F3DEC0] text-[#B2762A] flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Unmatched Question:</strong> No answer detected on the default page. Use &ldquo;Reassign Match&rdquo; if answered on another page.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Grading Result, Rubric & Teacher Approval (5 cols) */}
        <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E8E2D5] rounded-md flex flex-col shadow-2xs overflow-hidden">
          {questions.length === 0 ? (
            <div className="flex-1 p-5 space-y-4 overflow-y-auto text-xs">
              <div className="p-3 bg-[#FAF8F3] border-b border-[#E8E2D5] -m-5 mb-4">
                <span className="font-semibold text-[#1C1A17]">Reference Document Scoring</span>
              </div>

              <div className="space-y-1">
                <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
                  Whole Script Review
                </h3>
                <p className="text-xs text-[#6E685F] leading-relaxed">
                  This assessment relies directly on uploaded reference documents without manual question breakdowns. Grade the submission against the overall maximum score ({assessment.max_marks} marks) using the Question Paper and Marking Scheme.
                </p>
              </div>

              {/* Reference Documents Card */}
              <div className="p-3 bg-[#FAF8F3] border border-[#E8E2D5] rounded-md space-y-2">
                <span className="font-semibold text-[#1C1A17] block">Reference Exam Documents</span>
                <div className="space-y-1 text-[#6E685F]">
                  <div className="flex items-center justify-between">
                    <span>Question Paper:</span>
                    <span className="font-medium text-[#1C1A17]">{assessment.question_paper_name || "Exam Paper"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Marking Scheme:</span>
                    <span className="font-medium text-[#1C1A17]">{assessment.marking_scheme_name || "Marking Rubric"}</span>
                  </div>
                </div>
              </div>

              {/* Student details */}
              <div className="p-3.5 rounded border border-[#E8E2D5] bg-[#FAF8F3] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1C1A17]">Student Submission</span>
                  <StatusBadge status={currentScript?.status || "uploaded"} />
                </div>
                <div className="flex items-center justify-between text-[#6E685F]">
                  <span>Candidate: {currentScript?.student_name}</span>
                  <span className="font-mono">{currentScript?.roll_number}</span>
                </div>
                {currentScript?.total_score !== null && (
                  <div className="pt-2 border-t border-[#E8E2D5] flex items-center justify-between">
                    <span className="text-[#6E685F]">Current Approved Score:</span>
                    <span className="font-mono font-bold text-[#2A5A43]">
                      {currentScript?.total_score} / {assessment.max_marks} marks
                    </span>
                  </div>
                )}
              </div>

              {/* Score Input Form */}
              <div className="space-y-3 pt-3 border-t border-[#E8E2D5]">
                <label className="font-semibold text-[#1C1A17] text-xs block">
                  Teacher Approved Score *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={assessment.max_marks}
                    value={teacherScore}
                    onChange={(e) => setTeacherScore(e.target.value)}
                    className="w-24 p-2 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-base font-bold font-mono text-[#1C1A17] focus:border-[#2A5A43] focus:outline-hidden"
                  />
                  <span className="text-xs text-[#6E685F]">
                    out of {assessment.max_marks} marks
                  </span>
                </div>

                <div>
                  <label className="font-medium text-[#1C1A17] text-xs block mb-1">
                    Teacher Feedback & Comments:
                  </label>
                  <textarea
                    rows={3}
                    value={teacherFeedback}
                    onChange={(e) => setTeacherFeedback(e.target.value)}
                    placeholder="Enter teacher comments and overall feedback for this student..."
                    className="w-full p-2 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-xs text-[#1C1A17] focus:border-[#2A5A43] focus:outline-hidden"
                  />
                </div>

                {errorMsg && (
                  <div className="p-2 rounded bg-[#FDF2EE] border border-[#F1CDC3] text-xs text-[#C25B3E]">
                    {errorMsg}
                  </div>
                )}

                {saveSuccessMsg && (
                  <div className="p-2 rounded bg-[#EFF5F1] border border-[#BCD4C7] text-xs text-[#2A5A43]">
                    {saveSuccessMsg}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveWholeScriptScore}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] font-medium text-xs transition-colors shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve Student Score</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Question Selector Tabs */}
              <div className="p-3 bg-[#FAF8F3] border-b border-[#E8E2D5] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1C1A17]">Question Rubric</span>
                <div className="flex items-center gap-1">
              {questions.map((q) => {
                const res = results.find(
                  (r) =>
                    r.script_id === currentScript?.id && r.question_id === q.id
                );
                const isApproved = res?.status === "approved";
                const isSelected = selectedQuestionId === q.id;

                return (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuestionId(q.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-[#2A5A43] text-[#FBF9F5]"
                        : isApproved
                        ? "bg-[#EFF5F1] text-[#2A5A43] border border-[#BCD4C7]"
                        : "bg-[#FFFFFF] text-[#6E685F] border border-[#E8E2D5] hover:bg-[#F6F3EB]"
                    }`}
                  >
                    Q{q.question_number}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Body & Rationale */}
          <div className="flex-1 p-5 space-y-4 overflow-y-auto text-xs">
            {/* Question Prompt */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1C1A17]">
                  Question {currentQuestion?.question_number}
                </span>
                <span className="font-mono text-xs font-medium text-[#2A5A43]">
                  Max: {currentQuestion?.max_marks} marks
                </span>
              </div>
              <p className="text-[#1C1A17] text-xs leading-relaxed">
                {currentQuestion?.question_text}
              </p>
            </div>

            {/* Rubric Criteria Checklist */}
            <div className="space-y-2 pt-2 border-t border-[#E8E2D5]">
              <span className="font-semibold text-[#1C1A17] block">
                Criteria Checkpoints
              </span>
              <div className="space-y-1.5">
                {currentQuestion?.rubric_criteria.map((c) => {
                  const satisfied =
                    currentResult?.criteria_satisfied?.includes(c.id) ||
                    currentResult?.criteria_satisfied?.includes(c.criterion);

                  return (
                    <div
                      key={c.id}
                      className={`p-2 rounded border flex items-start justify-between gap-2 text-xs ${
                        satisfied
                          ? "bg-[#EFF5F1] border-[#BCD4C7] text-[#2A5A43]"
                          : "bg-[#FAF8F3] border-[#E8E2D5] text-[#6E685F]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Check
                          className={`w-3.5 h-3.5 mt-0.5 ${
                            satisfied ? "text-[#2A5A43]" : "text-[#D2CAB9]"
                          }`}
                        />
                        <span>{c.criterion}</span>
                      </div>
                      <span className="font-mono font-medium shrink-0">
                        {c.marks}m
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Proposed Score & Uncertainty Indicator */}
            <div className="p-3.5 rounded border border-[#E8E2D5] bg-[#FAF8F3] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#6E685F] block">
                    AI Proposed Score
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-serif font-bold text-[#1C1A17]">
                      {currentResult?.proposed_score ?? "—"}
                    </span>
                    <span className="text-xs text-[#6E685F]">
                      / {currentQuestion?.max_marks}
                    </span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <span className="text-[11px] text-[#6E685F] block">
                    Evidence Status
                  </span>
                  {currentResult && (
                    <UncertaintyBadge
                      status={currentResult.uncertainty_status}
                      confidenceScore={currentResult.confidence_score}
                    />
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[#1C1A17] block mb-0.5">
                  AI Evaluator Rationale:
                </span>
                <p className="text-xs text-[#6E685F] italic bg-[#FFFFFF] p-2.5 rounded border border-[#E8E2D5]">
                  &ldquo;{currentResult?.rationale || "Rationale pending evaluation."}&rdquo;
                </p>
              </div>
            </div>

            {/* Teacher Decision & Mark Change Audit Reason */}
            <div className="space-y-3 pt-3 border-t border-[#E8E2D5]">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#1C1A17] text-xs">
                  Teacher Approved Score *
                </label>
                <StatusBadge status={currentResult?.status || "draft"} />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={currentQuestion?.max_marks || 10}
                  value={teacherScore}
                  onChange={(e) => setTeacherScore(e.target.value)}
                  className="w-24 p-2 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-base font-bold font-mono text-[#1C1A17] focus:border-[#2A5A43] focus:outline-hidden"
                />
                <span className="text-xs text-[#6E685F]">
                  out of {currentQuestion?.max_marks} marks
                </span>
              </div>

              {/* Explicit Reason for Mark Change */}
              <div>
                <label className="font-medium text-[#1C1A17] text-xs block mb-1">
                  Reason for Mark Adjustment (Recorded in Audit Trail):
                </label>
                <input
                  type="text"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Alternative valid derivation; partial credit on intermediate step"
                  className="w-full p-2 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-xs text-[#1C1A17] focus:border-[#2A5A43] focus:outline-hidden"
                />
              </div>

              {/* Teacher Comments */}
              <div>
                <label className="font-medium text-[#1C1A17] text-xs block mb-1">
                  Teacher Feedback (Visible on Student Report Card):
                </label>
                <textarea
                  rows={2}
                  value={teacherFeedback}
                  onChange={(e) => setTeacherFeedback(e.target.value)}
                  placeholder="Add feedback visible to student..."
                  className="w-full p-2 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-xs text-[#1C1A17] focus:border-[#2A5A43] focus:outline-hidden"
                />
              </div>

              {/* View Audit Trail Link */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowAuditDrawer(!showAuditDrawer)}
                  className="inline-flex items-center gap-1 text-[11px] text-[#2A5A43] hover:underline"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>
                    View Audit History ({currentResult?.audit_history?.length || 0} entries)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleRejectProposal}
                  className="inline-flex items-center gap-1 text-[11px] text-[#C25B3E] hover:underline"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Reject Proposal</span>
                </button>
              </div>

              {/* Audit History Drawer */}
              {showAuditDrawer && currentResult?.audit_history && (
                <div className="p-2.5 rounded bg-[#FAF8F3] border border-[#E8E2D5] space-y-1.5 text-[11px]">
                  <p className="font-semibold text-[#1C1A17]">Review Log:</p>
                  {currentResult.audit_history.length === 0 ? (
                    <p className="text-[#8E877D] italic">No edits recorded yet.</p>
                  ) : (
                    currentResult.audit_history.map((a) => (
                      <div key={a.id} className="border-b border-[#E8E2D5] pb-1">
                        <span className="font-mono text-[#6E685F]">
                          {new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>{" "}
                        — <strong className="capitalize">{a.action.replace("_", " ")}</strong> by {a.teacher_name}
                        {a.previous_score !== undefined && a.new_score !== undefined && (
                          <span className="text-[#1C1A17]"> ({a.previous_score} &rarr; {a.new_score}m)</span>
                        )}
                        {a.reason && <p className="italic text-[#6E685F] mt-0.5">&ldquo;{a.reason}&rdquo;</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {errorMsg && (
                <div className="p-2 rounded bg-[#FDF2EE] border border-[#F1CDC3] text-xs text-[#C25B3E]">
                  {errorMsg}
                </div>
              )}

              {saveSuccessMsg && (
                <div className="p-2 rounded bg-[#EFF5F1] border border-[#BCD4C7] text-xs text-[#2A5A43]">
                  {saveSuccessMsg}
                </div>
              )}
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 bg-[#FAF8F3] border-t border-[#E8E2D5] flex items-center justify-between gap-3 text-xs">
            <button
              onClick={() => handleSaveAndApprove(false)}
              className="px-3 py-2 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FDF2EE] text-[#C25B3E] font-medium transition-colors"
            >
              Flag for Review
            </button>

            <button
              onClick={() => handleSaveAndApprove(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] font-medium transition-colors shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Approve Mark</span>
            </button>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Dialog: Flag Unreadable Handwriting */}
      {showUnreadableDialog && (
        <div className="fixed inset-0 z-50 bg-[#1C1A17]/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md max-w-md w-full p-5 space-y-4 shadow-lg border border-[#E8E2D5] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D5]">
              <h3 className="font-serif text-base font-semibold text-[#1C1A17] flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-[#C25B3E]" />
                <span>Flag Answer as Unreadable</span>
              </h3>
              <button
                onClick={() => setShowUnreadableDialog(false)}
                className="p-1 text-[#8E877D] hover:text-[#1C1A17]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[#6E685F]">
              Record the specific handwriting legibility issue for this answer. This prevents unverified score deduction and flags it for physical script inspection.
            </p>

            <div>
              <label className="font-medium text-[#1C1A17] block mb-1">
                Reason / Note for Audit Log:
              </label>
              <textarea
                rows={3}
                value={unreadableNote}
                onChange={(e) => setUnreadableNote(e.target.value)}
                className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-xs text-[#1C1A17]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUnreadableDialog(false)}
                className="px-3 py-1.5 rounded border border-[#E8E2D5] text-xs font-medium text-[#6E685F]"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagUnreadableConfirm}
                className="px-3 py-1.5 rounded bg-[#C25B3E] hover:bg-[#A84A30] text-xs font-medium text-[#FFFFFF]"
              >
                Flag as Unreadable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Reassign Question Match */}
      {showMatchDialog && (
        <div className="fixed inset-0 z-50 bg-[#1C1A17]/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md max-w-md w-full p-5 space-y-4 shadow-lg border border-[#E8E2D5] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D5]">
              <h3 className="font-serif text-base font-semibold text-[#1C1A17] flex items-center gap-1.5">
                <FileQuestion className="w-4 h-4 text-[#2A5A43]" />
                <span>Reassign Question Match</span>
              </h3>
              <button
                onClick={() => setShowMatchDialog(false)}
                className="p-1 text-[#8E877D] hover:text-[#1C1A17]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[#6E685F]">
              If the candidate answered questions out of order, you can re-route this answer crop to the intended question rubric.
            </p>

            <div>
              <label className="font-medium text-[#1C1A17] block mb-1">
                Reassign to Question:
              </label>
              <select
                value={newMatchQuestionId}
                onChange={(e) => setNewMatchQuestionId(e.target.value)}
                className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-xs text-[#1C1A17]"
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    Question {q.question_number} ({q.max_marks}m) — {q.question_text.slice(0, 45)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-medium text-[#1C1A17] block mb-1">
                Reason for Reassignment:
              </label>
              <input
                type="text"
                value={matchReason}
                onChange={(e) => setMatchReason(e.target.value)}
                className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-xs text-[#1C1A17]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowMatchDialog(false)}
                className="px-3 py-1.5 rounded border border-[#E8E2D5] text-xs font-medium text-[#6E685F]"
              >
                Cancel
              </button>
              <button
                onClick={handleCorrectMatchConfirm}
                className="px-3 py-1.5 rounded bg-[#2A5A43] hover:bg-[#214734] text-xs font-medium text-[#FFFFFF]"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GradingReviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="py-20 text-center text-xs text-[#6E685F]">
          Loading grading review workspace...
        </div>
      }
    >
      <ReviewWorkspaceContent {...props} />
    </React.Suspense>
  );
}
