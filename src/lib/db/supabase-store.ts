import { SupabaseClient } from "@supabase/supabase-js";
import {
  ApprovalStatus,
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
} from "../scoring/deterministic-calculator";
import { evaluateMapFreshness } from "../understanding/validator";
import { INITIAL_PROFILE } from "./repo";

// Validates whether a string is a standard RFC4122 UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ensures ID passed to PostgreSQL UUID column is valid.
 * Maps non-UUID synthetic strings (e.g. 'usr-teacher-001') deterministically to valid UUID format.
 */
export function normalizeUuid(id: string): string {
  if (UUID_REGEX.test(id)) {
    return id;
  }
  // Deterministic mapping for synthetic dev IDs
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-${hex.padEnd(12, "0")}`;
}

export class SupabaseStore {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  // --- Profiles ---
  async getProfile(teacherId: string): Promise<TeacherProfile> {
    const validId = normalizeUuid(teacherId);
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", validId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch teacher profile: ${error.message}`);
    }

    if (!data) {
      return {
        ...INITIAL_PROFILE,
        id: teacherId,
      };
    }

    return {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      school_name: data.school_name || INITIAL_PROFILE.school_name,
      department: data.department || INITIAL_PROFILE.department,
      rounding_mode: data.rounding_mode || "half_up",
      grade_bands: data.grade_bands || DEFAULT_GRADE_BANDS,
      default_max_marks: Number(data.default_max_marks) || 50,
      provider_mode: "mock",
      nebius_model: "nvidia/llama-3.1-nemotron-70b-instruct",
      nebius_api_key_configured: Boolean(process.env.NEBIUS_API_KEY),
    };
  }

  async updateProfile(
    teacherId: string,
    updates: Partial<TeacherProfile>
  ): Promise<TeacherProfile> {
    const validId = normalizeUuid(teacherId);
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.full_name !== undefined) payload.full_name = updates.full_name;
    if (updates.school_name !== undefined) payload.school_name = updates.school_name;
    if (updates.department !== undefined) payload.department = updates.department;
    if (updates.rounding_mode !== undefined) payload.rounding_mode = updates.rounding_mode;
    if (updates.grade_bands !== undefined) payload.grade_bands = updates.grade_bands;
    if (updates.default_max_marks !== undefined) payload.default_max_marks = updates.default_max_marks;

    const { error } = await this.client
      .from("profiles")
      .update(payload)
      .eq("id", validId);

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return this.getProfile(teacherId);
  }

  // --- Classes ---
  async getClasses(teacherId: string): Promise<ClassGroup[]> {
    const validTeacherId = normalizeUuid(teacherId);
    const { data: classesData, error: classesError } = await this.client
      .from("classes")
      .select("*, students(count)")
      .eq("teacher_id", validTeacherId)
      .order("created_at", { ascending: false });

    if (classesError) {
      throw new Error(`Failed to fetch classes: ${classesError.message}`);
    }

    return (classesData || []).map((c: any) => ({
      id: c.id,
      teacher_id: c.teacher_id,
      name: c.name,
      grade_level: c.grade_level,
      section: c.section,
      academic_year: c.academic_year,
      student_count: c.students?.[0]?.count || 0,
      created_at: c.created_at,
    }));
  }

  async getClass(id: string, teacherId?: string): Promise<ClassGroup | null> {
    let query = this.client
      .from("classes")
      .select("*, students(count)")
      .eq("id", id);
    if (teacherId) {
      query = query.eq("teacher_id", normalizeUuid(teacherId));
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      teacher_id: data.teacher_id,
      name: data.name,
      grade_level: data.grade_level,
      section: data.section,
      academic_year: data.academic_year,
      student_count: data.students?.[0]?.count || 0,
      created_at: data.created_at,
    };
  }

  async createClass(
    teacherId: string,
    classData: {
      name: string;
      grade_level: string;
      section: string;
      academic_year: string;
    }
  ): Promise<ClassGroup> {
    const validTeacherId = normalizeUuid(teacherId);
    const { data, error } = await this.client
      .from("classes")
      .insert({
        teacher_id: validTeacherId,
        name: classData.name,
        grade_level: classData.grade_level,
        section: classData.section,
        academic_year: classData.academic_year,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create class: ${error.message}`);
    }

    return {
      id: data.id,
      teacher_id: data.teacher_id,
      name: data.name,
      grade_level: data.grade_level,
      section: data.section,
      academic_year: data.academic_year,
      student_count: 0,
      created_at: data.created_at,
    };
  }

  async updateClass(id: string, teacherId: string, updates: Partial<ClassGroup>): Promise<ClassGroup | null> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name) payload.name = updates.name;
    if (updates.grade_level) payload.grade_level = updates.grade_level;
    if (updates.section) payload.section = updates.section;
    if (updates.academic_year) payload.academic_year = updates.academic_year;

    const { error } = await this.client
      .from("classes")
      .update(payload)
      .eq("id", id)
      .eq("teacher_id", normalizeUuid(teacherId));

    if (error) throw new Error(`Failed to update class: ${error.message}`);
    return this.getClass(id, teacherId);
  }

  // --- Students ---
  async getStudents(teacherId: string, classId?: string): Promise<Student[]> {
    const validTeacherId = normalizeUuid(teacherId);
    let query = this.client
      .from("students")
      .select("*")
      .eq("teacher_id", validTeacherId)
      .order("roll_number", { ascending: true });

    if (classId) {
      query = query.eq("class_id", classId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch students: ${error.message}`);
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      teacher_id: s.teacher_id,
      class_id: s.class_id,
      roll_number: s.roll_number,
      full_name: s.full_name,
      email: s.email,
      created_at: s.created_at,
    }));
  }

  async getStudent(id: string, teacherId?: string): Promise<Student | null> {
    let query = this.client.from("students").select("*").eq("id", id);
    if (teacherId) query = query.eq("teacher_id", normalizeUuid(teacherId));
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      teacher_id: data.teacher_id,
      class_id: data.class_id,
      roll_number: data.roll_number,
      full_name: data.full_name,
      email: data.email,
      created_at: data.created_at,
    };
  }

  async createStudent(
    teacherId: string,
    studentData: {
      class_id: string;
      roll_number: string;
      full_name: string;
      email?: string;
    }
  ): Promise<Student> {
    const validTeacherId = normalizeUuid(teacherId);
    const { data, error } = await this.client
      .from("students")
      .insert({
        teacher_id: validTeacherId,
        class_id: studentData.class_id,
        roll_number: studentData.roll_number,
        full_name: studentData.full_name,
        email: studentData.email,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create student: ${error.message}`);
    }

    return {
      id: data.id,
      teacher_id: data.teacher_id,
      class_id: data.class_id,
      roll_number: data.roll_number,
      full_name: data.full_name,
      email: data.email,
      created_at: data.created_at,
    };
  }

  async updateStudent(id: string, teacherId: string, updates: Partial<Student>): Promise<Student | null> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.full_name) payload.full_name = updates.full_name;
    if (updates.roll_number) payload.roll_number = updates.roll_number;
    if (updates.class_id) payload.class_id = updates.class_id;
    if (updates.email !== undefined) payload.email = updates.email;

    const { error } = await this.client
      .from("students")
      .update(payload)
      .eq("id", id)
      .eq("teacher_id", normalizeUuid(teacherId));

    if (error) throw new Error(`Failed to update student: ${error.message}`);
    return this.getStudent(id, teacherId);
  }

  // --- Assessments ---
  async getAssessments(teacherId: string): Promise<Assessment[]> {
    const validTeacherId = normalizeUuid(teacherId);
    const { data, error } = await this.client
      .from("assessments")
      .select(`
        *,
        student_scripts(id, status)
      `)
      .eq("teacher_id", validTeacherId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch assessments: ${error.message}`);
    }

    return (data || []).map((a: any) => {
      const scripts = a.student_scripts || [];
      const totalScripts = scripts.length;
      const gradedScripts = scripts.filter((s: any) => s.status === "graded" || s.status === "approved").length;
      const approvedScripts = scripts.filter((s: any) => s.status === "approved").length;

      return {
        id: a.id,
        teacher_id: a.teacher_id,
        class_id: a.class_id,
        title: a.title,
        subject: a.subject,
        grade_level: a.grade_level,
        section: a.section,
        max_marks: Number(a.max_marks),
        status: a.status,
        date: a.date,
        question_paper_path: a.question_paper_path,
        question_paper_name: a.question_paper_name,
        marking_scheme_path: a.marking_scheme_path,
        marking_scheme_name: a.marking_scheme_name,
        total_scripts: totalScripts,
        graded_scripts: gradedScripts,
        approved_scripts: approvedScripts,
        created_at: a.created_at,
      };
    });
  }

  async getAssessment(id: string, teacherId?: string): Promise<Assessment | null> {
    let query = this.client
      .from("assessments")
      .select(`
        *,
        student_scripts(id, status)
      `)
      .eq("id", id);

    if (teacherId) {
      query = query.eq("teacher_id", normalizeUuid(teacherId));
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch assessment: ${error.message}`);
    }

    if (!data) return null;

    const scripts = data.student_scripts || [];
    const totalScripts = scripts.length;
    const gradedScripts = scripts.filter((s: any) => s.status === "graded" || s.status === "approved").length;
    const approvedScripts = scripts.filter((s: any) => s.status === "approved").length;

    return {
      id: data.id,
      teacher_id: data.teacher_id,
      class_id: data.class_id,
      title: data.title,
      subject: data.subject,
      grade_level: data.grade_level,
      section: data.section,
      max_marks: Number(data.max_marks),
      status: data.status,
      date: data.date,
      question_paper_path: data.question_paper_path,
      question_paper_name: data.question_paper_name,
      marking_scheme_path: data.marking_scheme_path,
      marking_scheme_name: data.marking_scheme_name,
      total_scripts: totalScripts,
      graded_scripts: gradedScripts,
      approved_scripts: approvedScripts,
      created_at: data.created_at,
    };
  }

  async createAssessment(
    teacherIdOrData: string | any,
    dataMaybe?: any
  ): Promise<Assessment> {
    const teacherId = typeof teacherIdOrData === "string" ? teacherIdOrData : (teacherIdOrData.teacher_id || "usr-teacher-001");
    const data = typeof teacherIdOrData === "object" ? teacherIdOrData : dataMaybe;
    const validTeacherId = normalizeUuid(teacherId);

    const insertPayload: Record<string, any> = {
      teacher_id: validTeacherId,
      title: data.title,
      subject: data.subject,
      grade_level: data.grade_level,
      section: data.section,
      class_id: data.class_id || null,
      max_marks: data.max_marks,
      status: data.status || "draft",
      date: data.date || new Date().toISOString().split("T")[0],
      question_paper_path: data.question_paper_path || null,
      question_paper_name: data.question_paper_name || null,
      marking_scheme_path: data.marking_scheme_path || null,
      marking_scheme_name: data.marking_scheme_name || null,
    };

    if (data.id) {
      insertPayload.id = normalizeUuid(data.id);
    }

    const { data: assessmentData, error: assessmentError } = await this.client
      .from("assessments")
      .insert(insertPayload)
      .select()
      .single();

    if (assessmentError) {
      throw new Error(`Failed to create assessment: ${assessmentError.message}`);
    }

    // Insert questions if provided
    if (data.questions && data.questions.length > 0) {
      const questionsPayload = data.questions.map((q: any) => ({
        assessment_id: assessmentData.id,
        question_number: q.question_number,
        question_text: q.question_text,
        max_marks: q.max_marks,
        rubric_criteria: q.rubric_criteria || [],
        model_answer: q.model_answer || null,
      }));

      const { error: questionsError } = await this.client
        .from("assessment_questions")
        .insert(questionsPayload);

      if (questionsError) {
        throw new Error(`Failed to insert assessment questions: ${questionsError.message}`);
      }
    }

    return {
      id: assessmentData.id,
      teacher_id: assessmentData.teacher_id,
      class_id: assessmentData.class_id,
      title: assessmentData.title,
      subject: assessmentData.subject,
      grade_level: assessmentData.grade_level,
      section: assessmentData.section,
      max_marks: Number(assessmentData.max_marks),
      status: assessmentData.status,
      date: assessmentData.date,
      question_paper_path: assessmentData.question_paper_path,
      question_paper_name: assessmentData.question_paper_name,
      marking_scheme_path: assessmentData.marking_scheme_path,
      marking_scheme_name: assessmentData.marking_scheme_name,
      total_scripts: 0,
      graded_scripts: 0,
      approved_scripts: 0,
      created_at: assessmentData.created_at,
    };
  }

  async updateAssessment(
    id: string,
    teacherId: string,
    updates: Partial<Assessment> & {
      questions?: Array<{
        question_number: number;
        question_text?: string;
        max_marks: number;
        rubric_criteria?: any[];
        model_answer?: string;
      }>;
    }
  ): Promise<Assessment | null> {
    const validTeacherId = normalizeUuid(teacherId);
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.subject !== undefined) payload.subject = updates.subject;
    if (updates.grade_level !== undefined) payload.grade_level = updates.grade_level;
    if (updates.section !== undefined) payload.section = updates.section;
    if (updates.class_id !== undefined) payload.class_id = updates.class_id;
    if (updates.max_marks !== undefined) payload.max_marks = updates.max_marks;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.date !== undefined) payload.date = updates.date;
    if (updates.question_paper_path !== undefined) payload.question_paper_path = updates.question_paper_path;
    if (updates.question_paper_name !== undefined) payload.question_paper_name = updates.question_paper_name;
    if (updates.marking_scheme_path !== undefined) payload.marking_scheme_path = updates.marking_scheme_path;
    if (updates.marking_scheme_name !== undefined) payload.marking_scheme_name = updates.marking_scheme_name;

    const { error } = await this.client
      .from("assessments")
      .update(payload)
      .eq("id", id)
      .eq("teacher_id", validTeacherId);

    if (error) {
      throw new Error(`Failed to update assessment: ${error.message}`);
    }

    if (updates.questions && Array.isArray(updates.questions)) {
      // Refresh questions for this assessment
      await this.client
        .from("assessment_questions")
        .delete()
        .eq("assessment_id", id);

      if (updates.questions.length > 0) {
        const questionsPayload = updates.questions.map((q: any) => ({
          assessment_id: id,
          question_number: q.question_number,
          question_text: q.question_text || `Question ${q.question_number}`,
          max_marks: Number(q.max_marks) || 1,
          rubric_criteria: q.rubric_criteria || [],
          model_answer: q.model_answer || null,
        }));
        await this.client
          .from("assessment_questions")
          .insert(questionsPayload);
      }
    }

    return this.getAssessment(id, teacherId);
  }

  async deleteAssessment(id: string, teacherId: string): Promise<boolean> {
    const validTeacherId = normalizeUuid(teacherId);
    const { error } = await this.client
      .from("assessments")
      .delete()
      .eq("id", id)
      .eq("teacher_id", validTeacherId);

    if (error) {
      throw new Error(`Failed to delete assessment: ${error.message}`);
    }
    return true;
  }

  // --- Questions ---
  async getQuestions(assessmentId: string): Promise<AssessmentQuestion[]> {
    const { data, error } = await this.client
      .from("assessment_questions")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("question_number", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch assessment questions: ${error.message}`);
    }

    return (data || []).map((q: any) => ({
      id: q.id,
      assessment_id: q.assessment_id,
      question_number: q.question_number,
      question_text: q.question_text,
      max_marks: Number(q.max_marks),
      rubric_criteria: q.rubric_criteria || [],
      model_answer: q.model_answer,
    }));
  }

  // --- Scripts ---
  async getScripts(assessmentId: string): Promise<StudentScript[]> {
    const { data, error } = await this.client
      .from("student_scripts")
      .select(`
        *,
        students(full_name, roll_number)
      `)
      .eq("assessment_id", assessmentId)
      .order("uploaded_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch student scripts: ${error.message}`);
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      assessment_id: s.assessment_id,
      student_id: s.student_id,
      student_name: s.students?.full_name || "Unknown Student",
      roll_number: s.students?.roll_number || "—",
      file_name: s.file_name,
      file_path: s.file_path,
      file_size: Number(s.file_size),
      mime_type: s.mime_type,
      page_count: s.page_count || 1,
      status: s.status,
      total_score: s.total_score !== null ? Number(s.total_score) : null,
      max_score: 50,
      percentage: null,
      uploaded_at: s.uploaded_at,
    }));
  }

  async addScript(
    assessmentIdOrObj: string | any,
    studentId?: string,
    fileData?: {
      file_name: string;
      file_path: string;
      file_size: number;
      mime_type: string;
      page_count?: number;
      status?: StudentScript["status"];
      total_score?: number | null;
    }
  ): Promise<StudentScript> {
    const asmId = typeof assessmentIdOrObj === "object" ? assessmentIdOrObj.assessment_id : assessmentIdOrObj;
    const stuId = typeof assessmentIdOrObj === "object" ? assessmentIdOrObj.student_id : studentId!;
    const payload = typeof assessmentIdOrObj === "object" ? assessmentIdOrObj : fileData!;

    const { data, error } = await this.client
      .from("student_scripts")
      .insert({
        assessment_id: asmId,
        student_id: stuId,
        file_name: payload.file_name,
        file_path: payload.file_path,
        file_size: payload.file_size,
        mime_type: payload.mime_type || "application/pdf",
        page_count: payload.page_count || 1,
        status: payload.status || "uploaded",
        total_score: payload.total_score ?? null,
      })
      .select(`*, students(full_name, roll_number)`)
      .single();

    if (error) {
      throw new Error(`Failed to add student script: ${error.message}`);
    }

    return {
      id: data.id,
      assessment_id: data.assessment_id,
      student_id: data.student_id,
      student_name: data.students?.full_name || "Unknown Student",
      roll_number: data.students?.roll_number || "—",
      file_name: data.file_name,
      file_path: data.file_path,
      file_size: Number(data.file_size),
      mime_type: data.mime_type,
      page_count: data.page_count || 1,
      status: data.status,
      total_score: data.total_score !== null ? Number(data.total_score) : null,
      max_score: 50,
      percentage: null,
      uploaded_at: data.uploaded_at,
    };
  }

  // --- Grading Results ---
  async getGradingResults(assessmentId: string): Promise<GradingResult[]> {
    const { data, error } = await this.client
      .from("grading_results")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch grading results: ${error.message}`);
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      assessment_id: r.assessment_id,
      script_id: r.script_id,
      question_id: r.question_id,
      student_id: r.student_id,
      proposed_score: Number(r.proposed_score),
      approved_score: r.approved_score !== null ? Number(r.approved_score) : null,
      rationale: r.rationale,
      uncertainty_status: r.uncertainty_status,
      confidence_score: Number(r.confidence_score),
      criteria_satisfied: r.criteria_satisfied || [],
      feedback: r.feedback || "",
      status: r.status,
      is_mock: Boolean(r.is_mock),
      edited_by_teacher: Boolean(r.edited_by_teacher),
      answer_extracted_text: r.answer_extracted_text || undefined,
      script_page_index: r.script_page_index || 1,
      is_unreadable: Boolean(r.is_unreadable),
      unreadable_reason: r.unreadable_reason || undefined,
      is_unmatched: Boolean(r.is_unmatched),
      audit_history: r.audit_history || [],
      created_at: r.created_at,
      updated_at: r.updated_at || r.created_at || new Date().toISOString(),
    }));
  }

  async updateGradingResult(
    id: string,
    teacherId: string,
    updates: {
      approved_score?: number | null;
      feedback?: string;
      reason?: string;
      status?: GradingResult["status"];
    }
  ): Promise<GradingResult> {
    // 1. Fetch current result and verify parent assessment ownership
    const { data: current, error: fetchErr } = await this.client
      .from("grading_results")
      .select("*, assessments!inner(teacher_id)")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      throw new Error(`Grading result not found: ${fetchErr?.message}`);
    }

    if (current.assessments?.teacher_id !== normalizeUuid(teacherId)) {
      throw new Error("FORBIDDEN: You do not own the assessment for this grading result.");
    }

    const auditHistory: AuditRecord[] = current.audit_history || [];
    let isEdited = current.edited_by_teacher;

    if (updates.approved_score !== undefined && updates.approved_score !== current.approved_score) {
      isEdited = true;
      auditHistory.unshift({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        teacher_name: teacherId,
        previous_score: current.approved_score ?? current.proposed_score,
        new_score: updates.approved_score,
        reason: updates.reason || "Teacher reviewed score",
        action: "edited_mark",
      });
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      edited_by_teacher: isEdited,
      audit_history: auditHistory,
    };

    if (updates.approved_score !== undefined) payload.approved_score = updates.approved_score;
    if (updates.feedback !== undefined) payload.feedback = updates.feedback;
    if (updates.status !== undefined) payload.status = updates.status;

    const { data: updated, error: updateErr } = await this.client
      .from("grading_results")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update grading result: ${updateErr.message}`);
    }

    return {
      id: updated.id,
      assessment_id: updated.assessment_id,
      script_id: updated.script_id,
      question_id: updated.question_id,
      student_id: updated.student_id,
      proposed_score: Number(updated.proposed_score),
      approved_score: updated.approved_score !== null ? Number(updated.approved_score) : null,
      rationale: updated.rationale,
      uncertainty_status: updated.uncertainty_status,
      confidence_score: Number(updated.confidence_score),
      criteria_satisfied: updated.criteria_satisfied || [],
      feedback: updated.feedback || "",
      status: updated.status,
      is_mock: Boolean(updated.is_mock),
      edited_by_teacher: Boolean(updated.edited_by_teacher),
      answer_extracted_text: updated.answer_extracted_text || undefined,
      script_page_index: updated.script_page_index || 1,
      is_unreadable: Boolean(updated.is_unreadable),
      unreadable_reason: updated.unreadable_reason || undefined,
      is_unmatched: Boolean(updated.is_unmatched),
      audit_history: updated.audit_history || [],
      created_at: updated.created_at,
      updated_at: updated.updated_at || new Date().toISOString(),
    };
  }

  async getScript(id: string): Promise<StudentScript | null> {
    const { data, error } = await this.client
      .from("student_scripts")
      .select("*, students(full_name, roll_number)")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      assessment_id: data.assessment_id,
      student_id: data.student_id,
      student_name: data.students?.full_name || "Unknown Student",
      roll_number: data.students?.roll_number || "—",
      file_name: data.file_name,
      file_path: data.file_path,
      file_size: Number(data.file_size),
      mime_type: data.mime_type,
      page_count: data.page_count || 1,
      status: data.status,
      total_score: data.total_score !== null ? Number(data.total_score) : null,
      max_score: 50,
      percentage: null,
      uploaded_at: data.uploaded_at,
    };
  }

  async getGradingResult(id: string): Promise<GradingResult | null> {
    const { data, error } = await this.client
      .from("grading_results")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      assessment_id: data.assessment_id,
      script_id: data.script_id,
      question_id: data.question_id,
      student_id: data.student_id,
      proposed_score: Number(data.proposed_score),
      approved_score: data.approved_score !== null ? Number(data.approved_score) : null,
      rationale: data.rationale,
      uncertainty_status: data.uncertainty_status,
      confidence_score: Number(data.confidence_score),
      criteria_satisfied: data.criteria_satisfied || [],
      feedback: data.feedback || "",
      status: data.status,
      is_mock: Boolean(data.is_mock),
      edited_by_teacher: Boolean(data.edited_by_teacher),
      answer_extracted_text: data.answer_extracted_text || undefined,
      script_page_index: data.script_page_index || 1,
      is_unreadable: Boolean(data.is_unreadable),
      unreadable_reason: data.unreadable_reason || undefined,
      is_unmatched: Boolean(data.is_unmatched),
      audit_history: data.audit_history || [],
      created_at: data.created_at,
      updated_at: data.updated_at || data.created_at || new Date().toISOString(),
    };
  }

  async flagUnreadable(resultId: string, reason: string, teacherName?: string, teacherId?: string): Promise<GradingResult> {
    const tid = teacherId || "usr-teacher-001";
    return this.updateGradingResult(resultId, tid, {
      status: "needs_review",
      reason: `Flagged as unreadable: ${reason}`,
      feedback: `Unreadable: ${reason}`,
    });
  }

  async correctMatch(resultId: string, newQuestionId: string, reason: string, teacherName?: string, teacherId?: string): Promise<GradingResult> {
    const tid = teacherId || "usr-teacher-001";
    const payload: Record<string, unknown> = {
      question_id: newQuestionId,
      updated_at: new Date().toISOString(),
    };
    await this.client.from("grading_results").update(payload).eq("id", resultId);
    return this.updateGradingResult(resultId, tid, {
      reason: `Match corrected: ${reason}`,
    });
  }

  async rejectProposal(resultId: string, reason: string, teacherName?: string, teacherId?: string): Promise<GradingResult> {
    const tid = teacherId || "usr-teacher-001";
    return this.updateGradingResult(resultId, tid, {
      approved_score: 0,
      status: "needs_review",
      reason: `Rejected: ${reason}`,
      feedback: reason,
    });
  }

  async approveGradingResult(resultId: string, finalScore: number | undefined, reason?: string, teacherName?: string, teacherId?: string): Promise<GradingResult> {
    const tid = teacherId || "usr-teacher-001";
    return this.updateGradingResult(resultId, tid, {
      approved_score: finalScore,
      status: "approved",
      reason: reason || "Teacher approved grade",
    });
  }

  async approveAllResultsForScript(scriptId: string, teacherName?: string, teacherId?: string, finalScore?: number): Promise<void> {
    const { data: results } = await this.client
      .from("grading_results")
      .select("*")
      .eq("script_id", scriptId);

    const tid = teacherId || "usr-teacher-001";
    for (const res of results || []) {
      await this.approveGradingResult(res.id, res.approved_score ?? res.proposed_score, "Bulk approved with script", teacherName, tid);
    }
    const updatePayload: Record<string, unknown> = { status: "approved" };
    if (typeof finalScore === "number") {
      updatePayload.total_score = finalScore;
    }
    await this.client.from("student_scripts").update(updatePayload).eq("id", scriptId);
  }

  async saveGradingProposal(
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
  ): Promise<void> {
    const { data: existing } = await this.client
      .from("grading_results")
      .select("id")
      .eq("script_id", scriptId)
      .eq("question_id", questionId)
      .maybeSingle();

    const payload = {
      assessment_id: assessmentId,
      script_id: scriptId,
      question_id: questionId,
      student_id: studentId,
      proposed_score: evaluation.proposedMarks,
      approved_score: null,
      rationale: evaluation.conciseRationale,
      uncertainty_status: evaluation.uncertaintyStatus,
      confidence_score: evaluation.confidenceScore,
      criteria_satisfied: evaluation.criteriaSatisfied || [],
      status: evaluation.uncertaintyStatus === "high_uncertainty" ? "needs_review" : "proposed",
      is_mock: evaluation.isMock,
      edited_by_teacher: false,
      is_unreadable: evaluation.isUnreadable || false,
      is_unmatched: evaluation.isUnmatched || false,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.client.from("grading_results").update(payload).eq("id", existing.id);
    } else {
      await this.client.from("grading_results").insert(payload);
    }
  }

  // --- Markbook ---
  async getMarkbook(
    assessmentId: string,
    teacherId: string,
    targetScaleMax?: number
  ): Promise<{
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
  }> {
    const assessment = await this.getAssessment(assessmentId, teacherId);
    if (!assessment) {
      throw new Error("Assessment not found or access denied.");
    }

    const [questions, scripts, results, profile] = await Promise.all([
      this.getQuestions(assessmentId),
      this.getScripts(assessmentId),
      this.getGradingResults(assessmentId),
      this.getProfile(teacherId),
    ]);

    const studentList: Student[] = assessment.class_id
      ? await this.getStudents(teacherId, assessment.class_id)
      : scripts.map((s) => ({
          id: s.student_id,
          class_id: "",
          roll_number: s.roll_number,
          full_name: s.student_name,
          created_at: "",
        }));

    const rows: MarkbookRow[] = [];
    const scaleMax = targetScaleMax && targetScaleMax > 0 ? targetScaleMax : assessment.max_marks;

    for (const student of studentList) {
      const script = scripts.find((s) => s.student_id === student.id);
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

      const totals = calculateStudentTotals(scoreItems, scaleMax, profile.rounding_mode);

      let approvalStatus: ApprovalStatus = "draft";
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

      rows.push({
        student,
        script,
        question_scores,
        raw_total: totals.rawTotal,
        percentage: totals.percentage,
        converted_total: totals.convertedTotal,
        approval_status: approvalStatus,
        has_unattempted_or_missing: totals.hasMissing,
      });
    }

    const validScores = rows.map((r) => r.raw_total).filter((t): t is number => t !== null);
    const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;
    const highest = validScores.length > 0 ? Math.max(...validScores) : null;
    const lowest = validScores.length > 0 ? Math.min(...validScores) : null;
    const approvedCount = rows.filter((r) => r.approval_status === "approved").length;

    return {
      assessment,
      questions,
      rows,
      targetScaleMax: scaleMax,
      stats: {
        averageScore: avg !== null ? Math.round(avg * 10) / 10 : null,
        highestScore: highest,
        lowestScore: lowest,
        approvedCount,
        pendingCount: rows.length - approvedCount,
      },
    };
  }

  // --- Student Report Card ---
  async getStudentReportCard(
    studentId: string,
    teacherId: string
  ): Promise<ReportCardRecord> {
    const student = await this.getStudent(studentId, teacherId);
    if (!student) {
      throw new Error("Student not found or access denied.");
    }

    const classGroup = student.class_id ? await this.getClass(student.class_id, teacherId) : null;
    const allAssessments = await this.getAssessments(teacherId);
    const relevantAssessments = allAssessments.filter(
      (a) => !a.class_id || a.class_id === student.class_id
    );

    const profile = await this.getProfile(teacherId);

    // Fetch scripts for student
    const { data: rawScripts } = await this.client
      .from("student_scripts")
      .select("*")
      .eq("student_id", studentId);

    const scripts = rawScripts || [];

    const assessmentRecords = relevantAssessments.map((asm) => {
      const script = scripts.find((s) => s.assessment_id === asm.id);
      const hasScript = Boolean(script && script.total_score !== null);
      const rawScore = hasScript ? Number(script!.total_score) : null;
      const percentage = hasScript && asm.max_marks > 0 && rawScore !== null
        ? Math.round((rawScore / asm.max_marks) * 1000) / 10
        : null;

      const gradeInfo = resolveGradeBand(percentage, profile.grade_bands);

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

    const overallBand = resolveGradeBand(overallPct, profile.grade_bands);

    return {
      student,
      class_group: classGroup || undefined,
      assessments: assessmentRecords,
      overall_percentage: overallPct,
      overall_grade: overallBand.grade,
      total_assessments: assessmentRecords.length,
      completed_assessments: completed.length,
      missing_assessments: assessmentRecords.length - completed.length,
    };
  }

  // --- File Ownership Verification ---
  async getFileOwnerTeacherId(filePath: string): Promise<string | null> {
    // Check if referenced in student_scripts
    const { data: script } = await this.client
      .from("student_scripts")
      .select("assessments(teacher_id)")
      .eq("file_path", filePath)
      .maybeSingle();

    if (script && (script as any).assessments?.teacher_id) {
      return (script as any).assessments.teacher_id;
    }

    // Check if referenced in assessments
    const { data: assessment } = await this.client
      .from("assessments")
      .select("teacher_id")
      .or(`question_paper_path.eq.${filePath},marking_scheme_path.eq.${filePath}`)
      .maybeSingle();

    if (assessment && assessment.teacher_id) {
      return assessment.teacher_id;
    }

    return null;
  }

  // --- Understanding Maps ---
  async getUnderstandingMap(assessmentId: string): Promise<AssessmentUnderstandingMap | null> {
    const validAssessmentId = normalizeUuid(assessmentId);
    try {
      const { data, error } = await this.client
        .from("assessment_understanding_maps")
        .select("*")
        .eq("assessment_id", validAssessmentId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const map: AssessmentUnderstandingMap = {
        id: data.id,
        assessment_id: data.assessment_id,
        version: Number(data.version) || 1,
        status: data.status,
        syllabus_code: data.syllabus_code || undefined,
        paper_code: data.paper_code || undefined,
        exam_session: data.exam_session || undefined,
        source_question_paper: data.source_question_paper,
        source_marking_scheme: data.source_marking_scheme,
        total_max_marks: Number(data.total_max_marks) || 0,
        total_questions_count: Number(data.total_questions_count) || 0,
        nodes: data.nodes || [],
        unresolved_items_count: Number(data.unresolved_items_count) || 0,
        has_ambiguities: Boolean(data.has_ambiguities),
        verified_by: data.verified_by || undefined,
        verified_at: data.verified_at || undefined,
        teacher_notes: data.teacher_notes || undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      // Check freshness against current assessment paths
      const asm = await this.getAssessment(assessmentId);
      if (asm) {
        const freshness = evaluateMapFreshness(
          map,
          { path: asm.question_paper_path, name: asm.question_paper_name },
          { path: asm.marking_scheme_path, name: asm.marking_scheme_name }
        );
        if (freshness.isStale && map.status !== "stale") {
          map.status = "stale";
          map.updated_at = new Date().toISOString();
          await this.client
            .from("assessment_understanding_maps")
            .update({ status: "stale", updated_at: map.updated_at })
            .eq("id", map.id);
        }
      }

      return map;
    } catch {
      // In case migration has not been applied remotely yet, fail safe without throwing
      return null;
    }
  }

  async saveUnderstandingMap(mapData: AssessmentUnderstandingMap): Promise<AssessmentUnderstandingMap> {
    const validAssessmentId = normalizeUuid(mapData.assessment_id);
    const validId = normalizeUuid(mapData.id);
    const payload = {
      id: validId,
      assessment_id: validAssessmentId,
      version: Number(mapData.version) || 1,
      status: mapData.status,
      syllabus_code: mapData.syllabus_code || null,
      paper_code: mapData.paper_code || null,
      exam_session: mapData.exam_session || null,
      source_question_paper: mapData.source_question_paper,
      source_marking_scheme: mapData.source_marking_scheme,
      total_max_marks: Number(mapData.total_max_marks) || 0,
      total_questions_count: Number(mapData.total_questions_count) || 0,
      nodes: mapData.nodes || [],
      unresolved_items_count: Number(mapData.unresolved_items_count) || 0,
      has_ambiguities: Boolean(mapData.has_ambiguities),
      verified_by: mapData.verified_by ? normalizeUuid(mapData.verified_by) : null,
      verified_at: mapData.verified_at || null,
      teacher_notes: mapData.teacher_notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from("assessment_understanding_maps")
      .upsert(payload, { onConflict: "assessment_id" })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save understanding map: ${error.message}`);
    }

    return {
      ...mapData,
      id: data.id,
      updated_at: data.updated_at,
    };
  }

  async verifyUnderstandingMap(
    assessmentId: string,
    teacherId: string,
    teacherNotes?: string
  ): Promise<AssessmentUnderstandingMap | null> {
    const validAssessmentId = normalizeUuid(assessmentId);
    const validTeacherId = normalizeUuid(teacherId);
    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      status: "verified",
      verified_by: validTeacherId,
      verified_at: now,
      updated_at: now,
    };
    if (teacherNotes !== undefined) {
      updatePayload.teacher_notes = teacherNotes;
    }

    const { data, error } = await this.client
      .from("assessment_understanding_maps")
      .update(updatePayload)
      .eq("assessment_id", validAssessmentId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.getUnderstandingMap(assessmentId);
  }
}
