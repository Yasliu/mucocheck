import fs from "fs";
import path from "path";
import {
  Assessment,
  AssessmentQuestion,
  AuditRecord,
  ClassGroup,
  GradingResult,
  MarkbookRow,
  ReportCardRecord,
  Student,
  StudentScript,
  TeacherProfile,
  AssessmentUnderstandingMap,
} from "../types";
import {
  calculateStudentTotals,
  DEFAULT_GRADE_BANDS,
  resolveGradeBand,
  validateScoreBounds,
} from "../scoring/deterministic-calculator";
import { evaluateMapFreshness } from "../understanding/validator";
import {
  INITIAL_ASSESSMENTS,
  INITIAL_CLASSES,
  INITIAL_GRADING_RESULTS,
  INITIAL_PROFILE,
  INITIAL_QUESTIONS,
  INITIAL_SCRIPTS,
  INITIAL_STUDENTS,
} from "./repo";

interface DatabaseSchema {
  profile: TeacherProfile;
  classes: ClassGroup[];
  students: Student[];
  assessments: Assessment[];
  questions: AssessmentQuestion[];
  scripts: StudentScript[];
  results: GradingResult[];
  understanding_maps: AssessmentUnderstandingMap[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

class ServerStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    this.ensureDirectory();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.profile && Array.isArray(parsed.assessments)) {
          parsed.understanding_maps = parsed.understanding_maps || [];
          return parsed;
        }
      } catch (err) {
        console.warn("Failed to parse .data/db.json, reinitializing from defaults:", err);
      }
    }

    const initialData: DatabaseSchema = {
      profile: { ...INITIAL_PROFILE },
      classes: [...INITIAL_CLASSES],
      students: [...INITIAL_STUDENTS],
      assessments: [...INITIAL_ASSESSMENTS],
      questions: [...INITIAL_QUESTIONS],
      scripts: [...INITIAL_SCRIPTS],
      results: [...INITIAL_GRADING_RESULTS],
      understanding_maps: [],
    };

    this.saveData(initialData);
    return initialData;
  }

  private saveData(dataToSave?: DatabaseSchema): void {
    this.ensureDirectory();
    const data = dataToSave || this.data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving database to disk:", err);
    }
  }

  // Backup
  createBackup(label?: string): {
    backupPath: string;
    timestamp: string;
    stats: {
      assessments: number;
      students: number;
      classes: number;
      scripts: number;
      results: number;
    };
  } {
    const backupDir = path.join(DATA_DIR, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `db-backup-${label ? `${label}-` : ""}${timestamp}.json`;
    const backupPath = path.join(backupDir, filename);
    fs.writeFileSync(backupPath, JSON.stringify(this.data, null, 2), "utf-8");
    return {
      backupPath,
      timestamp,
      stats: {
        assessments: this.data.assessments.length,
        students: this.data.students.length,
        classes: this.data.classes.length,
        scripts: this.data.scripts.length,
        results: this.data.results.length,
      },
    };
  }

  // File Authorization & Ownership Lookup
  getFileOwnerTeacherId(relativePath: string): string | null {
    const normalized = relativePath.replace(/\\/g, "/");

    // Check in student scripts
    const script = this.data.scripts.find(
      (s) => s.file_path === normalized || s.file_path.endsWith(normalized)
    );
    if (script) {
      if (script.teacher_id) return script.teacher_id;
      const asm = this.getAssessment(script.assessment_id);
      return asm?.teacher_id || "usr-teacher-001";
    }

    // Check in assessment papers or marking schemes
    const asm = this.data.assessments.find(
      (a) =>
        (a.question_paper_path &&
          (a.question_paper_path === normalized || a.question_paper_path.endsWith(normalized))) ||
        (a.marking_scheme_path &&
          (a.marking_scheme_path === normalized || a.marking_scheme_path.endsWith(normalized)))
    );
    if (asm) {
      return asm.teacher_id || "usr-teacher-001";
    }

    return null;
  }

  // Profile
  getProfile(): TeacherProfile {
    return { ...this.data.profile };
  }

  updateProfile(updates: Partial<TeacherProfile>): TeacherProfile {
    this.data.profile = { ...this.data.profile, ...updates };
    this.saveData();
    return this.getProfile();
  }

  // Classes
  getClasses(teacherId?: string): ClassGroup[] {
    let list = this.data.classes;
    if (teacherId) {
      list = list.filter((cls) => !cls.teacher_id || cls.teacher_id === teacherId);
    }
    return list.map((cls) => {
      const count = this.data.students.filter((s) => s.class_id === cls.id).length;
      return { ...cls, student_count: count };
    });
  }

  getClass(id: string, teacherId?: string): ClassGroup | undefined {
    const cls = this.data.classes.find((c) => c.id === id);
    if (!cls) return undefined;
    if (teacherId && cls.teacher_id && cls.teacher_id !== teacherId) return undefined;
    const count = this.data.students.filter((s) => s.class_id === cls.id).length;
    return { ...cls, student_count: count };
  }

  createClass(data: Omit<ClassGroup, "id" | "created_at" | "student_count"> & { teacher_id?: string }): ClassGroup {
    const newClass: ClassGroup = {
      ...data,
      id: `cls-${Date.now()}`,
      teacher_id: data.teacher_id || "usr-teacher-001",
      student_count: 0,
      created_at: new Date().toISOString(),
    };
    this.data.classes.push(newClass);
    this.saveData();
    return newClass;
  }

  updateClass(id: string, updates: Partial<ClassGroup>): ClassGroup {
    const idx = this.data.classes.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Class not found");
    this.data.classes[idx] = { ...this.data.classes[idx], ...updates };
    this.saveData();
    return this.getClass(id)!;
  }

  deleteClass(id: string): void {
    this.data.classes = this.data.classes.filter((c) => c.id !== id);
    this.data.students = this.data.students.filter((s) => s.class_id !== id);
    this.saveData();
  }

  // Students
  getStudents(classId?: string, teacherId?: string): Student[] {
    let list = this.data.students;
    if (classId) {
      list = list.filter((s) => s.class_id === classId);
    }
    if (teacherId) {
      list = list.filter((s) => !s.teacher_id || s.teacher_id === teacherId);
    }
    return [...list];
  }

  getStudent(id: string, teacherId?: string): Student | undefined {
    const s = this.data.students.find((stu) => stu.id === id);
    if (!s) return undefined;
    if (teacherId && s.teacher_id && s.teacher_id !== teacherId) return undefined;
    return s;
  }

  createStudent(data: Omit<Student, "id" | "created_at"> & { teacher_id?: string }): Student {
    const newStudent: Student = {
      ...data,
      id: `stu-${Date.now()}`,
      teacher_id: data.teacher_id || "usr-teacher-001",
      created_at: new Date().toISOString(),
    };
    this.data.students.push(newStudent);
    this.saveData();
    return newStudent;
  }

  updateStudent(id: string, updates: Partial<Student>): Student {
    const idx = this.data.students.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Student not found");
    this.data.students[idx] = { ...this.data.students[idx], ...updates };
    this.saveData();
    return { ...this.data.students[idx] };
  }

  deleteStudent(id: string): void {
    this.data.students = this.data.students.filter((s) => s.id !== id);
    this.data.scripts = this.data.scripts.filter((scr) => scr.student_id !== id);
    this.data.results = this.data.results.filter((res) => res.student_id !== id);
    this.saveData();
  }

  // Assessments
  getAssessments(teacherId?: string): Assessment[] {
    if (teacherId) {
      return this.data.assessments.filter((a) => !a.teacher_id || a.teacher_id === teacherId);
    }
    return [...this.data.assessments];
  }

  getAssessment(id: string, teacherId?: string): Assessment | undefined {
    const asm = this.data.assessments.find((a) => a.id === id);
    if (!asm) return undefined;
    if (teacherId && asm.teacher_id && asm.teacher_id !== teacherId) return undefined;
    return asm;
  }

  createAssessment(data: {
    id?: string;
    teacher_id?: string;
    title: string;
    subject: string;
    grade_level: string;
    section: string;
    class_id?: string;
    max_marks: number;
    status?: Assessment["status"];
    date: string;
    question_paper_name?: string;
    question_paper_path?: string;
    marking_scheme_name?: string;
    marking_scheme_path?: string;
    questions?: Array<{
      question_number: number;
      question_text: string;
      max_marks: number;
      rubric_criteria?: Array<{ id: string; criterion: string; marks: number }>;
    }>;
  }): Assessment;
  createAssessment(teacherId: string, data: any): Assessment;
  createAssessment(
    teacherIdOrData: string | any,
    dataMaybe?: any
  ): Assessment {
    const data = typeof teacherIdOrData === "object" ? teacherIdOrData : { ...dataMaybe, teacher_id: teacherIdOrData };
    const assessmentId = data.id || `asm-${Date.now()}`;
    const newAssessment: Assessment = {
      id: assessmentId,
      teacher_id: data.teacher_id || "usr-teacher-001",
      title: data.title,
      subject: data.subject,
      grade_level: data.grade_level,
      section: data.section,
      class_id: data.class_id,
      max_marks: data.max_marks,
      status: data.status || "draft",
      date: data.date,
      question_paper_name: data.question_paper_name,
      question_paper_path: data.question_paper_path,
      marking_scheme_name: data.marking_scheme_name,
      marking_scheme_path: data.marking_scheme_path,
      total_scripts: 0,
      graded_scripts: 0,
      approved_scripts: 0,
      created_at: new Date().toISOString(),
    };

    // If assessment already exists (updating draft), replace or update
    const existingIdx = this.data.assessments.findIndex((a) => a.id === assessmentId);
    if (existingIdx !== -1) {
      this.data.assessments[existingIdx] = {
        ...this.data.assessments[existingIdx],
        ...newAssessment,
      };
    } else {
      this.data.assessments.push(newAssessment);
    }

    if (data.questions && data.questions.length > 0) {
      // Clear previous questions for this assessment
      this.data.questions = this.data.questions.filter((q) => q.assessment_id !== assessmentId);
      data.questions.forEach((q: any) => {
        this.data.questions.push({
          id: `q-${assessmentId}-${q.question_number}`,
          assessment_id: assessmentId,
          question_number: q.question_number,
          question_text: q.question_text,
          max_marks: q.max_marks,
          rubric_criteria: q.rubric_criteria || [],
        });
      });
    }

    this.saveData();
    return newAssessment;
  }

  updateAssessment(id: string, updates: Partial<Assessment>): Assessment {
    const idx = this.data.assessments.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Assessment not found");
    this.data.assessments[idx] = { ...this.data.assessments[idx], ...updates };
    this.saveData();
    return { ...this.data.assessments[idx] };
  }

  deleteAssessment(id: string): void {
    this.data.assessments = this.data.assessments.filter((a) => a.id !== id);
    this.data.questions = this.data.questions.filter((q) => q.assessment_id !== id);
    this.data.scripts = this.data.scripts.filter((s) => s.assessment_id !== id);
    this.data.results = this.data.results.filter((r) => r.assessment_id !== id);
    this.saveData();
  }

  // Questions
  getQuestions(assessmentId: string): AssessmentQuestion[] {
    return this.data.questions
      .filter((q) => q.assessment_id === assessmentId)
      .sort((a, b) => a.question_number - b.question_number);
  }

  addQuestion(data: Omit<AssessmentQuestion, "id">): AssessmentQuestion {
    const q: AssessmentQuestion = {
      ...data,
      id: `q-${Date.now()}-${data.question_number}`,
    };
    this.data.questions.push(q);
    this.saveData();
    return q;
  }

  // Scripts
  getScripts(assessmentId: string): StudentScript[] {
    return this.data.scripts.filter((s) => s.assessment_id === assessmentId);
  }

  getScript(id: string): StudentScript | undefined {
    return this.data.scripts.find((s) => s.id === id);
  }

  addScript(data: Omit<StudentScript, "id" | "uploaded_at"> & { teacher_id?: string }): StudentScript {
    // Check if script already exists for this student and assessment
    const existingIdx = this.data.scripts.findIndex(
      (s) => s.assessment_id === data.assessment_id && s.student_id === data.student_id
    );

    const asm = this.getAssessment(data.assessment_id);
    const teacherId = data.teacher_id || asm?.teacher_id || "usr-teacher-001";

    const script: StudentScript = {
      ...data,
      teacher_id: teacherId,
      id: existingIdx !== -1 ? this.data.scripts[existingIdx].id : `scr-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      uploaded_at: new Date().toISOString(),
    };

    if (existingIdx !== -1) {
      this.data.scripts[existingIdx] = script;
    } else {
      this.data.scripts.push(script);
    }

    if (asm) {
      this.updateAssessment(asm.id, {
        total_scripts: this.getScripts(asm.id).length,
      });
    }

    this.saveData();
    return script;
  }

  // Grading Results & Audit History
  getGradingResults(assessmentId: string, scriptId?: string): GradingResult[] {
    let list = this.data.results.filter((r) => r.assessment_id === assessmentId);
    if (scriptId) {
      list = list.filter((r) => r.script_id === scriptId);
    }
    return list;
  }

  getGradingResult(id: string): GradingResult | undefined {
    return this.data.results.find((r) => r.id === id);
  }

  updateGradingResult(
    resultId: string,
    updates: {
      approved_score?: number | null;
      feedback?: string;
      status?: "draft" | "proposed" | "needs_review" | "approved";
      edited_by_teacher?: boolean;
      reason?: string;
      teacher_name?: string;
      is_unreadable?: boolean;
      unreadable_reason?: string;
      is_unmatched?: boolean;
      question_id?: string;
    }
  ): GradingResult {
    const idx = this.data.results.findIndex((r) => r.id === resultId);
    if (idx === -1) throw new Error("Grading result not found");

    const existing = this.data.results[idx];

    // Score bounds validation
    if (updates.approved_score !== undefined && updates.approved_score !== null) {
      const targetQId = updates.question_id || existing.question_id;
      const q = this.data.questions.find((question) => question.id === targetQId);
      const max = q?.max_marks || 10;
      const validation = validateScoreBounds(updates.approved_score, max);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    // Build Audit Record
    const previousScore = existing.approved_score !== null ? existing.approved_score : existing.proposed_score;
    const newScore = updates.approved_score !== undefined ? updates.approved_score : existing.approved_score;

    let auditAction: AuditRecord["action"] = "edited_mark";
    if (updates.status === "approved") {
      auditAction = "approved";
    } else if (updates.is_unreadable) {
      auditAction = "flagged_unreadable";
    } else if (updates.question_id && updates.question_id !== existing.question_id) {
      auditAction = "corrected_match";
    }

    const auditHistory: AuditRecord[] = existing.audit_history ? [...existing.audit_history] : [];
    if (updates.edited_by_teacher || updates.status === "approved" || updates.reason) {
      auditHistory.push({
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        action: auditAction,
        teacher_name: updates.teacher_name || this.data.profile.full_name,
        previous_score: previousScore,
        new_score: newScore,
        reason: updates.reason || (updates.edited_by_teacher ? "Teacher score review" : undefined),
        previous_question_id: existing.question_id,
        new_question_id: updates.question_id,
      });
    }

    const updated: GradingResult = {
      ...existing,
      ...updates,
      audit_history: auditHistory,
      edited_by_teacher: updates.edited_by_teacher !== undefined ? updates.edited_by_teacher : true,
      updated_at: new Date().toISOString(),
    };

    this.data.results[idx] = updated;
    this.recalculateScriptTotals(existing.script_id);
    this.saveData();

    return updated;
  }

  addGradingResult(data: Omit<GradingResult, "id" | "updated_at">): GradingResult {
    const newResult: GradingResult = {
      ...data,
      id: `gr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      updated_at: new Date().toISOString(),
    };
    this.data.results.push(newResult);
    this.saveData();
    return newResult;
  }

  reassignQuestionMatch(resultId: string, newQuestionId: string, reason: string, teacherName?: string): GradingResult {
    return this.correctMatch(resultId, newQuestionId, reason, teacherName);
  }

  markAnswerUnreadable(resultId: string, reason: string, teacherName?: string): GradingResult {
    return this.flagUnreadable(resultId, reason, teacherName);
  }

  flagUnreadable(resultId: string, reason: string, teacherName?: string): GradingResult {
    return this.updateGradingResult(resultId, {
      is_unreadable: true,
      unreadable_reason: reason,
      status: "needs_review",
      reason: `Flagged as unreadable: ${reason}`,
      teacher_name: teacherName,
      edited_by_teacher: true,
    });
  }

  correctMatch(resultId: string, newQuestionId: string, reason: string, teacherName?: string): GradingResult {
    return this.updateGradingResult(resultId, {
      question_id: newQuestionId,
      is_unmatched: false,
      reason: `Match corrected by teacher: ${reason}`,
      teacher_name: teacherName,
      edited_by_teacher: true,
    });
  }

  approveGradingResult(resultId: string, finalScore?: number, reason?: string, teacherName?: string): GradingResult {
    const target = this.getGradingResult(resultId);
    if (!target) throw new Error("Grading result not found");

    const scoreToApprove = finalScore !== undefined ? finalScore : (target.approved_score ?? target.proposed_score);

    return this.updateGradingResult(resultId, {
      approved_score: scoreToApprove,
      status: "approved",
      reason: reason || "Teacher approved proposed mark",
      teacher_name: teacherName,
      edited_by_teacher: finalScore !== undefined,
    });
  }

  rejectProposal(resultId: string, reason: string, teacherName?: string): GradingResult {
    return this.updateGradingResult(resultId, {
      status: "needs_review",
      reason: `Proposal rejected: ${reason}`,
      teacher_name: teacherName,
      edited_by_teacher: true,
    });
  }

  approveAllResultsForScript(scriptId: string, teacherName?: string, teacherId?: string, finalScore?: number): void {
    const scriptResults = this.data.results.filter((r) => r.script_id === scriptId);
    for (const res of scriptResults) {
      const score = res.approved_score ?? res.proposed_score;
      this.updateGradingResult(res.id, {
        approved_score: score,
        status: "approved",
        teacher_name: teacherName,
        reason: "Batch script sign-off",
      });
    }

    const scrIdx = this.data.scripts.findIndex((s) => s.id === scriptId);
    if (scrIdx !== -1) {
      const updatedScr = { ...this.data.scripts[scrIdx], status: "approved" as const };
      if (typeof finalScore === "number") {
        updatedScr.total_score = finalScore;
        if (updatedScr.max_score > 0) {
          updatedScr.percentage = Math.round((finalScore / updatedScr.max_score) * 1000) / 10;
        }
      }
      this.data.scripts[scrIdx] = updatedScr;
    }

    this.saveData();
  }

  saveGradingProposal(
    assessmentId: string,
    scriptId: string,
    questionId: string,
    studentId: string,
    evaluation: {
      proposedMarks: number;
      conciseRationale: string;
      uncertaintyStatus: GradingResult["uncertainty_status"];
      confidenceScore: number;
      criteriaSatisfied?: string[];
      isMock: boolean;
      isUnreadable?: boolean;
      isUnmatched?: boolean;
    }
  ): void {
    const existing = this.data.results.find(
      (r) => r.script_id === scriptId && r.question_id === questionId
    );
    if (existing) {
      this.updateGradingResult(existing.id, {
        approved_score: null,
        status: evaluation.uncertaintyStatus === "high_uncertainty" ? "needs_review" : "proposed",
        feedback: evaluation.conciseRationale,
        edited_by_teacher: false,
        is_unreadable: evaluation.isUnreadable,
        is_unmatched: evaluation.isUnmatched,
      });
    } else {
      this.addGradingResult({
        assessment_id: assessmentId,
        student_id: studentId,
        script_id: scriptId,
        question_id: questionId,
        proposed_score: evaluation.proposedMarks,
        approved_score: null,
        rationale: evaluation.conciseRationale,
        uncertainty_status: evaluation.uncertaintyStatus,
        confidence_score: evaluation.confidenceScore,
        criteria_satisfied: evaluation.criteriaSatisfied || [],
        feedback: evaluation.conciseRationale,
        status: evaluation.uncertaintyStatus === "high_uncertainty" ? "needs_review" : "proposed",
        is_mock: evaluation.isMock,
        edited_by_teacher: false,
        audit_history: [],
        created_at: new Date().toISOString(),
      });
    }
  }

  private recalculateScriptTotals(scriptId: string): void {
    const scr = this.getScript(scriptId);
    if (!scr) return;

    const scriptResults = this.data.results.filter((r) => r.script_id === scriptId);
    const questions = this.getQuestions(scr.assessment_id);

    const questionScores = questions.map((q) => {
      const res = scriptResults.find((r) => r.question_id === q.id);
      const effectiveScore = res ? (res.approved_score ?? res.proposed_score) : null;
      return { score: effectiveScore, max: q.max_marks };
    });

    const totals = calculateStudentTotals(questionScores, undefined, this.data.profile.rounding_mode);

    const idx = this.data.scripts.findIndex((s) => s.id === scriptId);
    if (idx !== -1) {
      this.data.scripts[idx] = {
        ...this.data.scripts[idx],
        total_score: totals.rawTotal,
        percentage: totals.percentage,
      };
    }

    // Update assessment stats
    const allScripts = this.getScripts(scr.assessment_id);
    const approvedCount = allScripts.filter((s) => s.status === "approved").length;
    const gradedCount = allScripts.filter((s) => s.total_score !== null).length;

    const asm = this.getAssessment(scr.assessment_id);
    if (asm) {
      this.updateAssessment(asm.id, {
        approved_scripts: approvedCount,
        graded_scripts: gradedCount,
        status: approvedCount === allScripts.length && allScripts.length > 0 ? "completed" : "awaiting_review",
      });
    }
  }

  // Markbook
  getMarkbook(
    assessmentId: string,
    teacherIdOrTargetScale?: string | number,
    targetScaleMaxParam?: number
  ): {
    assessment: Assessment;
    questions: AssessmentQuestion[];
    rows: MarkbookRow[];
    targetScaleMax?: number;
    stats: {
      averageScore: number | null;
      highestScore: number | null;
      lowestScore: number | null;
      approvedCount: number;
      pendingCount: number;
    };
  } {
    const targetScaleMax = typeof teacherIdOrTargetScale === "number" ? teacherIdOrTargetScale : targetScaleMaxParam;
    const assessment = this.getAssessment(assessmentId);
    if (!assessment) throw new Error("Assessment not found");

    const questions = this.getQuestions(assessmentId);
    const scripts = this.getScripts(assessmentId);
    const results = this.getGradingResults(assessmentId);

    let studentList: Student[] = [];
    if (assessment.class_id) {
      studentList = this.getStudents(assessment.class_id);
    } else {
      const studentIds = Array.from(new Set(scripts.map((s) => s.student_id)));
      studentList = studentIds.map((id) => this.getStudent(id)!).filter(Boolean);
    }

    const rows: MarkbookRow[] = studentList.map((stu) => {
      const script = scripts.find((s) => s.student_id === stu.id);
      const question_scores: MarkbookRow["question_scores"] = {};
      const scoreItems: Array<{ score: number | null; max: number }> = [];

      for (const q of questions) {
        const res = script ? results.find((r) => r.script_id === script.id && r.question_id === q.id) : undefined;
        if (res) {
          const effective = res.approved_score !== null ? res.approved_score : res.proposed_score;
          question_scores[q.id] = {
            proposed_score: res.proposed_score,
            approved_score: res.approved_score,
            status: res.status,
            is_mock: res.is_mock,
            uncertainty_status: res.uncertainty_status,
            grading_result_id: res.id,
          };
          scoreItems.push({ score: effective, max: q.max_marks });
        } else {
          scoreItems.push({ score: null, max: q.max_marks });
        }
      }

      const totals = calculateStudentTotals(scoreItems, targetScaleMax, this.data.profile.rounding_mode);

      let approvalStatus: MarkbookRow["approval_status"] = "draft";
      if (script) {
        const statuses = Object.values(question_scores).map((qs) => qs.status);
        if (statuses.length > 0 && statuses.every((s) => s === "approved")) {
          approvalStatus = "approved";
        } else if (statuses.some((s) => s === "needs_review")) {
          approvalStatus = "needs_review";
        } else if (statuses.some((s) => s === "proposed")) {
          approvalStatus = "proposed";
        }
      }

      return {
        student: stu,
        script,
        question_scores,
        raw_total: totals.rawTotal,
        percentage: totals.percentage,
        converted_total: totals.convertedTotal,
        approval_status: approvalStatus,
        has_unattempted_or_missing: totals.hasMissing,
      };
    });

    const validScores = rows.map((r) => r.raw_total).filter((t): t is number => t !== null);
    const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;
    const highest = validScores.length > 0 ? Math.max(...validScores) : null;
    const lowest = validScores.length > 0 ? Math.min(...validScores) : null;
    const approvedCount = rows.filter((r) => r.approval_status === "approved").length;

    return {
      assessment,
      questions,
      rows,
      targetScaleMax,
      stats: {
        averageScore: avg !== null ? Math.round(avg * 10) / 10 : null,
        highestScore: highest,
        lowestScore: lowest,
        approvedCount,
        pendingCount: rows.length - approvedCount,
      },
    };
  }

  // Report Card Compilation
  getStudentReportCard(studentId: string): ReportCardRecord {
    const student = this.getStudent(studentId);
    if (!student) throw new Error("Student not found");

    const classGroup = this.getClass(student.class_id);
    const allAssessments = this.getAssessments().filter(
      (a) => !a.class_id || a.class_id === student.class_id
    );

    const assessmentRecords = allAssessments.map((asm) => {
      const script = this.data.scripts.find(
        (s) => s.assessment_id === asm.id && s.student_id === student.id
      );

      const hasScript = Boolean(script && script.total_score !== null);
      const rawScore = hasScript ? script!.total_score : null;
      const percentage = hasScript && asm.max_marks > 0 && rawScore !== null
        ? Math.round((rawScore / asm.max_marks) * 1000) / 10
        : null;

      const gradeInfo = resolveGradeBand(percentage, this.data.profile.grade_bands);

      return {
        assessment: asm,
        raw_score: rawScore,
        max_marks: asm.max_marks,
        percentage,
        converted_marks: percentage,
        grade_band: hasScript ? gradeInfo.grade : "Absent / Pending",
        is_missing: !hasScript,
        teacher_notes: script?.status === "approved" ? "Verified and approved." : "Under teacher review.",
      };
    });

    const completed = assessmentRecords.filter((r) => !r.is_missing && r.percentage !== null);
    const overallPct =
      completed.length > 0
        ? Math.round((completed.reduce((acc, r) => acc + (r.percentage || 0), 0) / completed.length) * 10) / 10
        : null;

    const overallBand = resolveGradeBand(overallPct, this.data.profile.grade_bands);

    return {
      student,
      class_group: classGroup,
      assessments: assessmentRecords,
      overall_percentage: overallPct,
      overall_grade: overallBand.grade,
      total_assessments: assessmentRecords.length,
      completed_assessments: completed.length,
      missing_assessments: assessmentRecords.length - completed.length,
    };
  }

  resetToDefaultSeed(): void {
    const initialData: DatabaseSchema = {
      profile: { ...INITIAL_PROFILE },
      classes: [...INITIAL_CLASSES],
      students: [...INITIAL_STUDENTS],
      assessments: [...INITIAL_ASSESSMENTS],
      questions: [...INITIAL_QUESTIONS],
      scripts: [...INITIAL_SCRIPTS],
      results: [...INITIAL_GRADING_RESULTS],
      understanding_maps: [],
    };
    this.data = initialData;
    this.saveData(initialData);
  }

  // Understanding Maps
  getUnderstandingMap(assessmentId: string): AssessmentUnderstandingMap | null {
    const map = this.data.understanding_maps.find((m) => m.assessment_id === assessmentId);
    if (!map) return null;

    const asm = this.getAssessment(assessmentId);
    if (asm) {
      const freshness = evaluateMapFreshness(
        map,
        { path: asm.question_paper_path, name: asm.question_paper_name },
        { path: asm.marking_scheme_path, name: asm.marking_scheme_name }
      );
      if (freshness.isStale && map.status !== "stale") {
        map.status = "stale";
        map.updated_at = new Date().toISOString();
        this.saveData();
      }
    }

    return map;
  }

  saveUnderstandingMap(mapData: AssessmentUnderstandingMap): AssessmentUnderstandingMap {
    const existingIdx = this.data.understanding_maps.findIndex(
      (m) => m.assessment_id === mapData.assessment_id
    );

    const now = new Date().toISOString();
    const mapToSave: AssessmentUnderstandingMap = {
      ...mapData,
      updated_at: now,
      created_at: existingIdx !== -1 ? this.data.understanding_maps[existingIdx].created_at : (mapData.created_at || now),
    };

    if (existingIdx !== -1) {
      this.data.understanding_maps[existingIdx] = mapToSave;
    } else {
      this.data.understanding_maps.push(mapToSave);
    }

    this.saveData();
    return mapToSave;
  }

  verifyUnderstandingMap(
    assessmentId: string,
    teacherId: string,
    teacherNotes?: string
  ): AssessmentUnderstandingMap | null {
    const map = this.getUnderstandingMap(assessmentId);
    if (!map) return null;

    map.status = "verified";
    map.verified_by = teacherId;
    map.verified_at = new Date().toISOString();
    if (teacherNotes !== undefined) {
      map.teacher_notes = teacherNotes;
    }
    map.updated_at = new Date().toISOString();

    const idx = this.data.understanding_maps.findIndex((m) => m.assessment_id === assessmentId);
    if (idx !== -1) {
      this.data.understanding_maps[idx] = map;
      this.saveData();
    }

    return map;
  }
}

export const serverStore = new ServerStore();
