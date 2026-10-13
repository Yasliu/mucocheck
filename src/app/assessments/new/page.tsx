"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { repository } from "@/lib/db/repo";
import { ClassGroup, Student } from "@/lib/types";
import { validateUploadedFile } from "@/lib/storage/file-storage";

interface QuestionInput {
  question_number: number;
  question_text: string;
  max_marks: number;
  criteria_text: string;
}

interface UploadedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  studentId?: string;
  studentName?: string;
  progress: number;
  previewUrl?: string;
}

export default function NewAssessmentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

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
  const [markingSchemeFile, setMarkingSchemeFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<QuestionInput[]>([
    {
      question_number: 1,
      question_text: "Describe the function of ATP Synthase in the inner mitochondrial membrane.",
      max_marks: 10,
      criteria_text: "Proton motive force (3), F0/F1 rotor rotation (4), ADP phosphorylation (3)",
    },
    {
      question_number: 2,
      question_text: "Compare light reactions and the Calvin Cycle in chloroplasts.",
      max_marks: 10,
      criteria_text: "Thylakoid vs Stroma (3), ATP/NADPH transport (4), RuBisCO carbon fixation (3)",
    },
    {
      question_number: 3,
      question_text: "Calculate net ATP yield under anaerobic fermentation in yeast.",
      max_marks: 10,
      criteria_text: "Net 2 ATP calculation (3), Acetaldehyde & ethanol steps (4), Contrast with lactic acid (3)",
    },
  ]);

  // Step 3: Student Scripts
  const [scriptFiles, setScriptFiles] = useState<UploadedFileItem[]>([]);
  const [selectedStudentForUpload, setSelectedStudentForUpload] = useState("");

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const clsList = repository.getClasses();
    setClasses(clsList);
    if (clsList.length > 0) {
      setSelectedClassId(clsList[0].id);
      setGradeLevel(clsList[0].grade_level);
      setSection(clsList[0].section);
      const stus = repository.getStudents(clsList[0].id);
      setStudents(stus);
      if (stus.length > 0) {
        setSelectedStudentForUpload(stus[0].id);
      }
    }
  }, []);

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    const cls = classes.find((c) => c.id === classId);
    if (cls) {
      setGradeLevel(cls.grade_level);
      setSection(cls.section);
    }
    const stus = repository.getStudents(classId);
    setStudents(stus);
    if (stus.length > 0) {
      setSelectedStudentForUpload(stus[0].id);
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
    setQuestions(
      updated.map((q, i) => ({ ...q, question_number: i + 1 }))
    );
  };

  const handleQuestionChange = (idx: number, field: keyof QuestionInput, value: string | number) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuestions(updated);
  };

  const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newItems: UploadedFileItem[] = [];

    for (const f of files) {
      const val = validateUploadedFile(f);
      if (!val.valid) {
        alert(`${f.name}: ${val.error}`);
        continue;
      }

      const assignedStudent = students.find((s) => s.id === selectedStudentForUpload);
      let previewUrl: string | undefined;
      if (f.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(f);
      }

      newItems.push({
        id: `upl-${Date.now()}-${Math.random()}`,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
        studentId: assignedStudent?.id,
        studentName: assignedStudent?.full_name || "Unassigned Student",
        progress: 100,
        previewUrl,
      });
    }

    setScriptFiles([...scriptFiles, ...newItems]);
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
    if (questions.length === 0) {
      errs.questions = "At least one assessment question is required.";
    }
    const qSum = questions.reduce((acc, q) => acc + Number(q.max_marks || 0), 0);
    if (qSum !== Number(maxMarks)) {
      errs.questionSum = `Sum of question marks (${qSum}) does not match assessment maximum marks (${maxMarks}).`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    setCurrentStep((prev) => Math.min(4, prev + 1));
  };

  const handleFinalSubmit = () => {
    setIsSubmitting(true);
    try {
      // 1. Create Assessment
      const createdAssessment = repository.createAssessment({
        title,
        subject,
        grade_level: gradeLevel,
        section,
        class_id: selectedClassId || undefined,
        max_marks: Number(maxMarks),
        date,
        question_paper_name: questionPaperFile?.name || "Exam_Paper.pdf",
        question_paper_path: `/uploads/${questionPaperFile?.name || "Exam_Paper.pdf"}`,
        marking_scheme_name: markingSchemeFile?.name || "Rubric_Official.pdf",
        marking_scheme_path: `/uploads/${markingSchemeFile?.name || "Rubric_Official.pdf"}`,
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
      });

      // 2. Attach scripts if uploaded
      for (const scr of scriptFiles) {
        if (scr.studentId) {
          repository.addScript({
            assessment_id: createdAssessment.id,
            student_id: scr.studentId,
            student_name: scr.studentName || "Student",
            roll_number: students.find((s) => s.id === scr.studentId)?.roll_number || "BIO-000",
            file_name: scr.name,
            file_path: `/uploads/scripts/${scr.name}`,
            file_size: scr.size,
            mime_type: scr.type || "application/pdf",
            page_count: 2,
            status: "uploaded",
            total_score: null,
            max_score: Number(maxMarks),
            percentage: null,
          });
        }
      }

      router.push(`/assessments/${createdAssessment.id}`);
    } catch (err: unknown) {
      alert(`Failed to create assessment: ${err instanceof Error ? err.message : String(err)}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb & Title */}
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
              New Assessment
            </h2>
            <p className="text-xs text-[#6E685F]">
              Step-by-step guided setup for question papers, rubrics, and answer scripts.
            </p>
          </div>
        </div>
      </div>

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
              {errors.title && (
                <p className="text-xs text-[#C25B3E]">{errors.title}</p>
              )}
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
              {errors.subject && (
                <p className="text-xs text-[#C25B3E]">{errors.subject}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#1C1A17]">
                Assign to Class / Cohort
              </label>
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
              <label className="font-medium text-[#1C1A17]">
                Maximum Marks *
              </label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                min={1}
                className="w-full p-2.5 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-sm text-[#1C1A17] focus:outline-hidden focus:border-[#2A5A43]"
              />
              {errors.maxMarks && (
                <p className="text-xs text-[#C25B3E]">{errors.maxMarks}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#1C1A17]">
                Assessment Date
              </label>
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
              2. Question Paper, Rubric & Breakdown
            </h3>
            <p className="text-xs text-[#6E685F] mt-1">
              Upload the official question paper and configure the per-question marks and criteria.
            </p>
          </div>

          {/* Reference Document Uploaders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-dashed border-[#D2CAB9] rounded-md p-4 bg-[#FAF8F3] text-center space-y-2">
              <Upload className="w-6 h-6 text-[#8E877D] mx-auto" />
              <p className="text-xs font-medium text-[#1C1A17]">
                Question Paper (PDF or Image)
              </p>
              <p className="text-[11px] text-[#6E685F]">
                {questionPaperFile ? questionPaperFile.name : "Optional master reference"}
              </p>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => e.target.files && setQuestionPaperFile(e.target.files[0])}
                className="text-xs text-[#6E685F] file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-[#BCD4C7] file:bg-[#EFF5F1] file:text-[#2A5A43] file:text-xs"
              />
            </div>

            <div className="border border-dashed border-[#D2CAB9] rounded-md p-4 bg-[#FAF8F3] text-center space-y-2">
              <FileText className="w-6 h-6 text-[#8E877D] mx-auto" />
              <p className="text-xs font-medium text-[#1C1A17]">
                Marking Scheme / Rubric (PDF or Image)
              </p>
              <p className="text-[11px] text-[#6E685F]">
                {markingSchemeFile ? markingSchemeFile.name : "Optional answer key"}
              </p>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => e.target.files && setMarkingSchemeFile(e.target.files[0])}
                className="text-xs text-[#6E685F] file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-[#BCD4C7] file:bg-[#EFF5F1] file:text-[#2A5A43] file:text-xs"
              />
            </div>
          </div>

          {/* Question Breakdown List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#1C1A17]">
                Question Breakdown (Target Total: {maxMarks} marks)
              </h4>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-1 text-xs text-[#2A5A43] hover:text-[#214734] font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            {errors.questionSum && (
              <div className="p-2.5 rounded bg-[#FDF2EE] border border-[#F1CDC3] text-xs text-[#C25B3E] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.questionSum}</span>
              </div>
            )}

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
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="p-1 text-[#8E877D] hover:text-[#C25B3E]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={q.question_text}
                      onChange={(e) =>
                        handleQuestionChange(idx, "question_text", e.target.value)
                      }
                      placeholder="Question prompt or instructions..."
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
          </div>
        </div>
      )}

      {/* Step 3: Student Roster & Script Uploads */}
      {currentStep === 3 && (
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-6 space-y-6">
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
              3. Student Answer Scripts
            </h3>
            <p className="text-xs text-[#6E685F] mt-1">
              Select student candidate and upload handwritten script files (PDF, PNG, JPG).
            </p>
          </div>

          {/* Upload Row */}
          <div className="p-4 rounded border border-[#E8E2D5] bg-[#FAF8F3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex-1 space-y-1">
              <label className="font-medium text-[#1C1A17] block">
                Assign upload to Student:
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
                <span>Choose Script File</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={handleScriptUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Uploaded Scripts Roster */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#1C1A17] flex items-center justify-between">
              <span>Attached Scripts ({scriptFiles.length})</span>
              <span className="text-[#6E685F] font-normal">
                Files are validated against 25MB limits
              </span>
            </h4>

            {scriptFiles.length === 0 ? (
              <div className="py-8 text-center text-[#8E877D] border border-dashed border-[#D2CAB9] rounded-md text-xs">
                No scripts attached yet. You can attach student scripts now or add them later from the assessment page.
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
                          Student: {scr.studentName} • {(scr.size / 1024).toFixed(0)} KB
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
              4. Review Assessment & Processing Plan
            </h3>
            <p className="text-xs text-[#6E685F] mt-1">
              Verify configuration prior to initiating the evaluation workspace.
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
                <span className="text-[#6E685F]">Maximum Marks</span>
                <p className="font-medium text-[#1C1A17] mt-0.5">{maxMarks}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E2D5] flex items-center justify-between text-[#6E685F]">
              <span>Questions Configured: {questions.length}</span>
              <span>Answer Scripts Uploaded: {scriptFiles.length}</span>
            </div>
          </div>

          {/* Processing Pipeline Stage Explainer */}
          <div className="p-4 rounded border border-[#BCD4C7] bg-[#EFF5F1] text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium text-[#2A5A43]">
              <Sparkles className="w-4 h-4 text-[#2A5A43]" />
              <span>Assessment Pipeline Architecture</span>
            </div>
            <p className="text-[#2A5A43] leading-relaxed">
              When created, the workspace stages documents into private storage. Handwriting recognition and grading results will be processed using the configured provider. <strong>Simulated marks are transparently labeled</strong> until teacher sign-off.
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
            <span>{isSubmitting ? "Creating Assessment..." : "Create Assessment"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
