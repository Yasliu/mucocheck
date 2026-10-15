"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  Plus,
  Eye,
  Sparkles,
  Save,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { repository } from "@/lib/db/repo";
import { ClassGroup, Student } from "@/lib/types";
import { validateUploadedFile } from "@/lib/storage/validation";

interface QuestionInput {
  question_number: number;
  question_text: string;
  max_marks: number;
  criteria_text: string;
}

interface UploadedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  studentId?: string;
  studentName?: string;
  filePath?: string;
  progress: number;
  previewUrl?: string;
}

function NewAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId");

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [draftAssessmentId, setDraftAssessmentId] = useState<string>(draftId || "");
  const [draftSavedNotice, setDraftSavedNotice] = useState<string>("");

  // Step 1: Metadata
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Biology");
  const [gradeLevel, setGradeLevel] = useState("Grade 10");
  const [section, setSection] = useState("A");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [maxMarks, setMaxMarks] = useState<number>(30);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Step 2: Reference Docs & Questions
  const [questionPaperFile, setQuestionPaperFile] = useState<File | null>(null);
  const [questionPaperPath, setQuestionPaperPath] = useState<string>("");
  const [markingSchemeFile, setMarkingSchemeFile] = useState<File | null>(null);
  const [markingSchemePath, setMarkingSchemePath] = useState<string>("");
  const [uploadingRef, setUploadingRef] = useState<boolean>(false);

  const [questions, setQuestions] = useState<QuestionInput[]>([]);

  // Step 3: Student Scripts
  const [scriptFiles, setScriptFiles] = useState<UploadedFileItem[]>([]);
  const [selectedStudentForUpload, setSelectedStudentForUpload] = useState("");
  const [uploadingScripts, setUploadingScripts] = useState(false);

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadInitial() {
      // Fetch classes
      try {
        const res = await fetch("/api/classes");
        if (res.ok) {
          const data = await res.json();
          setClasses(data.classes);
          if (data.classes.length > 0 && !selectedClassId) {
            setSelectedClassId(data.classes[0].id);
            setGradeLevel(data.classes[0].grade_level);
            setSection(data.classes[0].section);
          }
        } else {
          setClasses(repository.getClasses());
        }
      } catch {
        setClasses(repository.getClasses());
      }

      // Check if resuming draft
      if (draftId) {
        try {
          const asmRes = await fetch(`/api/assessments/${draftId}`);
          if (asmRes.ok) {
            const data = await asmRes.json();
            const a = data.assessment;
            setTitle(a.title);
            setSubject(a.subject);
            setGradeLevel(a.grade_level);
            setSection(a.section);
            setMaxMarks(a.max_marks);
            setDate(a.date);
            if (a.class_id) setSelectedClassId(a.class_id);
            if (a.question_paper_path) setQuestionPaperPath(a.question_paper_path);
            if (a.marking_scheme_path) setMarkingSchemePath(a.marking_scheme_path);
            if (data.questions && data.questions.length > 0) {
              setQuestions(
                data.questions.map((q: any) => ({
                  question_number: q.question_number,
                  question_text: q.question_text,
                  max_marks: q.max_marks,
                  criteria_text: q.rubric_criteria?.map((c: any) => c.criterion).join(", ") || "",
                }))
              );
            }
          }
        } catch (e) {
          console.warn("Draft fetch error:", e);
        }
      }
    }

    loadInitial();
  }, [draftId]);

  useEffect(() => {
    if (selectedClassId) {
      async function loadStudents() {
        try {
          const res = await fetch(`/api/students?classId=${selectedClassId}`);
          if (res.ok) {
            const data = await res.json();
            setStudents(data.students);
            if (data.students.length > 0) {
              setSelectedStudentForUpload(data.students[0].id);
            }
          } else {
            const stus = repository.getStudents(selectedClassId);
            setStudents(stus);
            if (stus.length > 0) setSelectedStudentForUpload(stus[0].id);
          }
        } catch {
          const stus = repository.getStudents(selectedClassId);
          setStudents(stus);
          if (stus.length > 0) setSelectedStudentForUpload(stus[0].id);
        }
      }
      loadStudents();
    }
  }, [selectedClassId]);

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    const cls = classes.find((c) => c.id === classId);
    if (cls) {
      setGradeLevel(cls.grade_level);
      setSection(cls.section);
    }
  };

  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    setQuestions([
      ...questions,
      {
        question_number: nextNum,
        question_text: `Question ${nextNum} description...`,
        max_marks: 5,
        criteria_text: "Point 1 (2.5 marks), Point 2 (2.5 marks)",
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated.map((q, i) => ({ ...q, question_number: i + 1 })));
  };

  const handleQuestionChange = (idx: number, field: keyof QuestionInput, value: string | number) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuestions(updated);
  };

  // Upload Question Paper to private storage
  const handleUploadQuestionPaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const val = validateUploadedFile(file);
    if (!val.valid) {
      alert(val.error);
      return;
    }

    setUploadingRef(true);
    setQuestionPaperFile(file);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "papers");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setQuestionPaperPath(data.filePath);
      } else {
        alert("Failed to upload question paper to server storage");
      }
    } catch {
      alert("Error uploading question paper");
    } finally {
      setUploadingRef(false);
    }
  };

  // Upload Marking Scheme to private storage
  const handleUploadMarkingScheme = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const val = validateUploadedFile(file);
    if (!val.valid) {
      alert(val.error);
      return;
    }

    setUploadingRef(true);
    setMarkingSchemeFile(file);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "schemes");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setMarkingSchemePath(data.filePath);
      } else {
        alert("Failed to upload marking scheme to server storage");
      }
    } catch {
      alert("Error uploading marking scheme");
    } finally {
      setUploadingRef(false);
    }
  };

  // Upload student scripts with physical persistence to private server storage
  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setUploadingScripts(true);

    const newItems: UploadedFileItem[] = [];

    for (const f of files) {
      const val = validateUploadedFile(f);
      if (!val.valid) {
        alert(`${f.name}: ${val.error}`);
        continue;
      }

      const assignedStudent = students.find((s) => s.id === selectedStudentForUpload);

      try {
        const formData = new FormData();
        formData.append("file", f);
        formData.append("category", "scripts");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          newItems.push({
            id: `upl-${Date.now()}-${Math.random()}`,
            name: f.name,
            size: f.size,
            type: f.type,
            studentId: assignedStudent?.id,
            studentName: assignedStudent?.full_name || "Candidate",
            filePath: data.filePath,
            progress: 100,
            previewUrl: data.url,
          });
        }
      } catch (err) {
        console.error("Script upload failed:", err);
      }
    }

    setScriptFiles((prev) => [...prev, ...newItems]);
    setUploadingScripts(false);
  };

  const handleRemoveScript = (id: string) => {
    setScriptFiles(scriptFiles.filter((s) => s.id !== id));
  };

  // Step Validation
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Assessment title is required.";
    if (!subject.trim()) errs.subject = "Subject is required.";
    if (maxMarks <= 0) errs.maxMarks = "Maximum marks must be greater than zero.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    // Note: Questions are optional in this phase. Teachers can rely directly on uploaded
    // Question Paper and Marking Scheme reference documents without retyping question text.
    if (questions.length > 0) {
      const qSum = questions.reduce((acc, q) => acc + Number(q.max_marks || 0), 0);
      if (qSum > Number(maxMarks)) {
        errs.questionSum = `Sum of question marks (${qSum}) exceeds assessment maximum marks (${maxMarks}).`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    setCurrentStep((prev) => Math.min(4, prev + 1));
  };

  // Save Draft (Available at any step)
  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      const assessmentId = draftAssessmentId || `asm-${Date.now()}`;
      const payload = {
        id: assessmentId,
        title: title.trim() || "Untitled Draft Assessment",
        subject: subject.trim() || "General",
        grade_level: gradeLevel,
        section,
        class_id: selectedClassId || undefined,
        max_marks: Number(maxMarks) || 50,
        status: "draft" as const,
        date,
        question_paper_name: questionPaperFile?.name || (questionPaperPath ? "Exam_Paper.pdf" : undefined),
        question_paper_path: questionPaperPath || undefined,
        marking_scheme_name: markingSchemeFile?.name || (markingSchemePath ? "Marking_Rubric.pdf" : undefined),
        marking_scheme_path: markingSchemePath || undefined,
        questions: questions.map((q) => ({
          question_number: q.question_number,
          question_text: q.question_text,
          max_marks: Number(q.max_marks),
          rubric_criteria: q.criteria_text.split(",").map((c, i) => ({
            id: `crit-${i + 1}`,
            criterion: c.trim(),
            marks: Math.max(1, Math.round(Number(q.max_marks) / (q.criteria_text.split(",").length || 1))),
          })),
        })),
      };

      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const savedId = data.assessment?.id || assessmentId;
        setDraftAssessmentId(savedId);
        setDraftSavedNotice("Draft saved successfully to private storage. You can resume anytime.");
        setTimeout(() => setDraftSavedNotice(""), 3500);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Error saving draft assessment: ${errData.error || res.statusText}`);
      }
    } catch (err: unknown) {
      alert(`Error saving draft assessment: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final Publish / Start Processing
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const assessmentId = draftAssessmentId || `asm-${Date.now()}`;
      const payload = {
        id: assessmentId,
        title,
        subject,
        grade_level: gradeLevel,
        section,
        class_id: selectedClassId || undefined,
        max_marks: Number(maxMarks),
        status: scriptFiles.length > 0 ? ("awaiting_review" as const) : ("ready" as const),
        date,
        question_paper_name: questionPaperFile?.name || (questionPaperPath ? "Exam_Paper.pdf" : undefined),
        question_paper_path: questionPaperPath || undefined,
        marking_scheme_name: markingSchemeFile?.name || (markingSchemePath ? "Marking_Rubric.pdf" : undefined),
        marking_scheme_path: markingSchemePath || undefined,
        questions: questions.map((q) => ({
          question_number: q.question_number,
          question_text: q.question_text,
          max_marks: Number(q.max_marks),
          rubric_criteria: q.criteria_text.split(",").map((c, i) => ({
            id: `crit-${i + 1}`,
            criterion: c.trim(),
            marks: Math.max(1, Math.round(Number(q.max_marks) / (q.criteria_text.split(",").length || 1))),
          })),
        })),
      };

      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save assessment to backend");
      }

      const resData = await res.json();
      const actualId = resData.assessment?.id || assessmentId;

      // Attach script files via API if any were uploaded
      for (const scr of scriptFiles) {
        if (scr.studentId && scr.filePath) {
          const sRes = await fetch(`/api/assessments/${actualId}/scripts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              student_id: scr.studentId,
              student_name: scr.studentName,
              roll_number: students.find((s) => s.id === scr.studentId)?.roll_number || "BIO-000",
              file_name: scr.name,
              file_path: scr.filePath,
              file_size: scr.size,
              mime_type: scr.type || "application/pdf",
              page_count: 2,
            }),
          });
          if (!sRes.ok) {
            console.error("Failed to attach script:", scr.name);
          }
        }
      }

      router.push(`/assessments/${actualId}`);
    } catch (err: unknown) {
      alert(`Failed to create assessment: ${err instanceof Error ? err.message : String(err)}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header & Save Draft Action */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E8E2D5]">
        <div className="flex items-center gap-2">
          <Link
            href="/assessments"
            className="p-1 rounded text-[#6E685F] hover:text-[#1C1A17] hover:bg-[#F6F3EB]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#1C1A17]">
              {draftAssessmentId ? "Edit Assessment" : "New Assessment"}
            </h2>
            <p className="text-xs text-[#6E685F]">
              Step-by-step guided setup with draft recovery and private storage.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] text-xs font-medium text-[#1C1A17] transition-colors shadow-2xs"
        >
          <Save className="w-3.5 h-3.5 text-[#2A5A43]" />
          <span>Save Draft</span>
        </button>
      </div>

      {draftSavedNotice && (
        <div className="p-3 rounded bg-[#EFF5F1] border border-[#BCD4C7] text-xs text-[#2A5A43] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{draftSavedNotice}</span>
        </div>
      )}

      {/* Step Indicator Progress Bar */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-4">
        <div className="flex items-center justify-between text-xs">
          {[
            { num: 1, label: "Assessment Details" },
            { num: 2, label: "Questions & Rubrics" },
            { num: 3, label: "Answer Scripts" },
            { num: 4, label: "Review & Start" },
          ].map((st) => (
            <div key={st.num} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-medium text-xs ${
                  currentStep === st.num
                    ? "bg-[#2A5A43] text-[#FBF9F5]"
                    : currentStep > st.num
                    ? "bg-[#EFF5F1] text-[#2A5A43] border border-[#BCD4C7]"
                    : "bg-[#F6F3EB] text-[#8E877D]"
                }`}
              >
                {currentStep > st.num ? <Check className="w-3.5 h-3.5" /> : st.num}
              </div>
              <span
                className={`hidden sm:inline font-medium ${
                  currentStep === st.num ? "text-[#1C1A17]" : "text-[#8E877D]"
                }`}
              >
                {st.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Details */}
      {currentStep === 1 && (
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-6 space-y-5">
          <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
            1. Assessment Metadata
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-medium text-[#1C1A17]">
                Assessment Name / Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cellular Respiration & Photosynthesis Midterm"
                className="w-full p-2.5 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-sm text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
              />
              {errors.title && <p className="text-xs text-[#C25B3E]">{errors.title}</p>}
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#1C1A17]">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Biology, Chemistry"
                className="w-full p-2.5 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-sm text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
              />
              {errors.subject && <p className="text-xs text-[#C25B3E]">{errors.subject}</p>}
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#1C1A17]">Assign to Class / Cohort</label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full p-2.5 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-sm text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.grade_level} Sec {cls.section})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#1C1A17]">Grade Level</label>
              <input
                type="text"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="Grade 10"
                className="w-full p-2.5 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-sm text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#1C1A17]">Section</label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A"
                className="w-full p-2.5 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-sm text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#1C1A17]">Maximum Marks *</label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                min={1}
                className="w-full p-2.5 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-sm text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
              />
              {errors.maxMarks && <p className="text-xs text-[#C25B3E]">{errors.maxMarks}</p>}
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#1C1A17]">Assessment Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-sm text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Reference Uploads & Questions */}
      {currentStep === 2 && (
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-6 space-y-6">
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
              2. Reference Documents & Optional Question Breakdown
            </h3>
            <p className="text-xs text-[#6E685F] mt-1">
              Upload the original exam documents. The uploaded Question Paper is the authoritative source for questions and diagrams.
            </p>
          </div>

          {/* Reference Document Uploaders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-dashed border-[#D2CAB9] rounded-md p-4 bg-[#FAF8F3] text-center space-y-2">
              <Upload className="w-6 h-6 text-[#8E877D] mx-auto" />
              <p className="text-xs font-medium text-[#1C1A17]">
                Question Paper (Reference Exam)
              </p>
              <p className="text-[11px] text-[#6E685F]">
                {questionPaperPath ? `Saved: ${questionPaperPath}` : "Master exam paper (PDF or Image)"}
              </p>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleUploadQuestionPaper}
                disabled={uploadingRef}
                className="text-xs text-[#6E685F] file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-[#BCD4C7] file:bg-[#EFF5F1] file:text-[#2A5A43] file:text-xs"
              />
            </div>

            <div className="border border-dashed border-[#D2CAB9] rounded-md p-4 bg-[#FAF8F3] text-center space-y-2">
              <FileText className="w-6 h-6 text-[#8E877D] mx-auto" />
              <p className="text-xs font-medium text-[#1C1A17]">
                Marking Scheme / Rubric (Reference Key)
              </p>
              <p className="text-[11px] text-[#6E685F]">
                {markingSchemePath ? `Saved: ${markingSchemePath}` : "Answer key & criteria (PDF or Image)"}
              </p>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleUploadMarkingScheme}
                disabled={uploadingRef}
                className="text-xs text-[#6E685F] file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-[#BCD4C7] file:bg-[#EFF5F1] file:text-[#2A5A43] file:text-xs"
              />
            </div>
          </div>

          {/* Question Breakdown Clarification Box */}
          <div className="p-3.5 rounded bg-[#FAF8F3] border border-[#E8E2D5] text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-[#1C1A17]">
              <Sparkles className="w-3.5 h-3.5 text-[#2A5A43]" />
              <span>Optional Manual Question Breakdown</span>
            </div>
            <p className="text-[#6E685F] leading-relaxed">
              You can create and evaluate this assessment using your uploaded reference documents directly against the overall maximum marks ({maxMarks} marks) without retyping questions. Manual question entry is completely optional and can also be defined or edited later.
            </p>
          </div>

          {/* Question Breakdown List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-[#1C1A17]">
                  Defined Questions ({questions.length})
                </h4>
                {questions.length > 0 && (
                  <p className="text-[11px] text-[#6E685F]">
                    Defined marks sum: {questions.reduce((acc, q) => acc + Number(q.max_marks || 0), 0)} / Overall max: {maxMarks} marks
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-1 text-xs text-[#2A5A43] hover:text-[#214734] font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question Breakdown</span>
              </button>
            </div>

            {errors.questionSum && (
              <div className="p-2.5 rounded bg-[#FDF2EE] border border-[#F1CDC3] text-xs text-[#C25B3E] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.questionSum}</span>
              </div>
            )}

            {questions.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[#D2CAB9] rounded-md bg-[#FAF8F3] text-xs text-[#6E685F] space-y-1">
                <p className="font-medium text-[#1C1A17]">No manual questions defined</p>
                <p>The assessment will reference your uploaded Question Paper and Marking Scheme directly. Click &quot;Add Question Breakdown&quot; above if you want to define structured question checkpoints.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded border border-[#E8E2D5] bg-[#FAF8F3] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#1C1A17]">
                        Question {q.question_number}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#6E685F]">Max Marks:</span>
                        <input
                          type="number"
                          value={q.max_marks}
                          onChange={(e) =>
                            handleQuestionChange(idx, "max_marks", Number(e.target.value))
                          }
                          className="w-16 p-1 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-right font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="p-1 text-[#8E877D] hover:text-[#C25B3E]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={q.question_text}
                        onChange={(e) =>
                          handleQuestionChange(idx, "question_text", e.target.value)
                        }
                        placeholder="Question prompt or label..."
                        className="w-full p-2 bg-[#FFFFFF] border border-[#E8E2D5] rounded"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-[#6E685F] block mb-0.5">
                        Rubric Criteria (comma separated checkpoints):
                      </label>
                      <input
                        type="text"
                        value={q.criteria_text}
                        onChange={(e) =>
                          handleQuestionChange(idx, "criteria_text", e.target.value)
                        }
                        placeholder="e.g. Formula (2), Intermediate steps (2), Conclusion (1)"
                        className="w-full p-2 bg-[#FFFFFF] border border-[#E8E2D5] rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Student Roster & Script Uploads */}
      {currentStep === 3 && (
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-6 space-y-6">
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
              3. Student Answer Scripts (Optional at Creation)
            </h3>
            <p className="text-xs text-[#6E685F] mt-1">
              Upload student answer submissions now, or skip this step and attach them later from the assessment workspace.
            </p>
          </div>

          <div className="p-3 rounded bg-[#EFF5F1] border border-[#BCD4C7] text-xs text-[#2A5A43] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Reference documents (Question Paper & Marking Scheme) were captured in Step 2. Only student submission scripts belong here.</span>
          </div>

          {/* Upload Row */}
          <div className="p-4 rounded border border-[#E8E2D5] bg-[#FAF8F3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex-1 space-y-1">
              <label className="font-medium text-[#1C1A17] block">
                Assign upload to Candidate:
              </label>
              <select
                value={selectedStudentForUpload}
                onChange={(e) => setSelectedStudentForUpload(e.target.value)}
                className="w-full p-2 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-[#1C1A17]"
              >
                {students.map((stu) => (
                  <option key={stu.id} value={stu.id}>
                    {stu.roll_number} — {stu.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="shrink-0 pt-2 sm:pt-4">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingScripts ? "Uploading to Storage..." : "Upload Script File"}</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={handleScriptUpload}
                  disabled={uploadingScripts}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Uploaded Scripts Roster */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#1C1A17] flex items-center justify-between">
              <span>Attached Student Scripts ({scriptFiles.length})</span>
              <span className="text-[#6E685F] font-normal">
                PDF and image formats supported (up to 25MB)
              </span>
            </h4>

            {scriptFiles.length === 0 ? (
              <div className="py-8 text-center text-[#8E877D] border border-dashed border-[#D2CAB9] rounded-md text-xs space-y-1">
                <p className="font-medium text-[#1C1A17]">No student scripts uploaded yet</p>
                <p>You can proceed to finalize the assessment now and upload student submissions whenever they are collected.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E8E2D5] border border-[#E8E2D5] rounded-md bg-[#FFFFFF] overflow-hidden text-xs">
                {scriptFiles.map((scr) => (
                  <div
                    key={scr.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-[#FAF8F3]"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-[#2A5A43]" />
                      <div>
                        <p className="font-medium text-[#1C1A17]">{scr.name}</p>
                        <p className="text-[11px] text-[#6E685F]">
                          Student: {scr.studentName} • {(scr.size / 1024).toFixed(0)} KB •{" "}
                          <span className="font-mono text-[#2A5A43]">Persisted in private storage</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {scr.previewUrl && (
                        <a
                          href={scr.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-[#6E685F] hover:text-[#1C1A17]"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveScript(scr.id)}
                        className="p-1 text-[#8E877D] hover:text-[#C25B3E]"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Review & Start */}
      {currentStep === 4 && (
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-6 space-y-6">
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
              4. Review Assessment Summary
            </h3>
            <p className="text-xs text-[#6E685F] mt-1">
              Verify configuration prior to saving and opening the assessment workspace.
            </p>
          </div>

          {/* Configuration Summary Card */}
          <div className="p-4 rounded border border-[#E8E2D5] bg-[#FAF8F3] space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[#6E685F]">Title</span>
                <p className="font-medium text-[#1C1A17] mt-0.5">{title}</p>
              </div>
              <div>
                <span className="text-[#6E685F]">Subject</span>
                <p className="font-medium text-[#1C1A17] mt-0.5">{subject}</p>
              </div>
              <div>
                <span className="text-[#6E685F]">Cohort</span>
                <p className="font-medium text-[#1C1A17] mt-0.5">
                  {gradeLevel} ({section})
                </p>
              </div>
              <div>
                <span className="text-[#6E685F]">Overall Max Marks</span>
                <p className="font-medium text-[#1C1A17] mt-0.5">{maxMarks}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E2D5] grid grid-cols-1 sm:grid-cols-3 gap-2 text-[#6E685F]">
              <div>
                <span className="block text-[11px] text-[#8E877D]">Question Paper:</span>
                <span className="font-medium text-[#1C1A17]">{questionPaperFile?.name || (questionPaperPath ? "Attached" : "None")}</span>
              </div>
              <div>
                <span className="block text-[11px] text-[#8E877D]">Marking Scheme:</span>
                <span className="font-medium text-[#1C1A17]">{markingSchemeFile?.name || (markingSchemePath ? "Attached" : "None")}</span>
              </div>
              <div>
                <span className="block text-[11px] text-[#8E877D]">Questions Configured:</span>
                <span className="font-medium text-[#1C1A17]">{questions.length > 0 ? `${questions.length} questions` : "Using Reference Docs Directly"}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E8E2D5] flex items-center justify-between text-[#6E685F]">
              <span>Attached Student Scripts: {scriptFiles.length}</span>
              <span>Status: {scriptFiles.length > 0 ? "Ready for review" : "Ready (scripts pending)"}</span>
            </div>
          </div>

          {/* Document & Evaluation Clarification */}
          <div className="p-4 rounded border border-[#BCD4C7] bg-[#EFF5F1] text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium text-[#2A5A43]">
              <CheckCircle2 className="w-4 h-4 text-[#2A5A43]" />
              <span>Reference Documents & Privacy</span>
            </div>
            <p className="text-[#2A5A43] leading-relaxed">
              All documents are stored securely in private storage. The original Question Paper serves as the primary exam reference in the split-screen workspace, and all marks remain provisional until approved by the teacher.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => prev - 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] text-xs font-medium text-[#1C1A17] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>
        ) : (
          <div />
        )}

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium transition-colors"
          >
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleFinalSubmit}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-sm font-medium transition-colors shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? "Finalizing Assessment..." : "Finalize & Open Assessment"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-[#6E685F]">Loading assessment wizard...</div>}>
      <NewAssessmentContent />
    </Suspense>
  );
}
