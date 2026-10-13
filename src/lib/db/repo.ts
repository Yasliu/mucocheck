import {
  Assessment,
  AssessmentQuestion,
  ClassGroup,
  GradingResult,
  MarkbookRow,
  ReportCardRecord,
  Student,
  StudentScript,
  TeacherProfile,
} from "../types";
import {
  calculateStudentTotals,
  DEFAULT_GRADE_BANDS,
  resolveGradeBand,
  validateScoreBounds,
} from "../scoring/deterministic-calculator";

// Initial Teacher Profile
export const INITIAL_PROFILE: TeacherProfile = {
  id: "teacher-mucono-01",
  full_name: "Dr. Eleanor Vance",
  email: "eleanor.vance@mucono.school",
  school_name: "St. Jude Collegiate Academy",
  department: "Natural Sciences & Mathematics",
  rounding_mode: "half_up",
  grade_bands: DEFAULT_GRADE_BANDS,
  default_max_marks: 50,
  provider_mode: "mock",
  nebius_model: "nvidia/llama-3.1-nemotron-70b-instruct",
  nebius_api_key_configured: false,
};

// Initial Seed Classes
export const INITIAL_CLASSES: ClassGroup[] = [
  {
    id: "cls-bio-10a",
    name: "Grade 10 Biology",
    grade_level: "Grade 10",
    section: "A",
    academic_year: "2026-2027",
    student_count: 5,
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "cls-chem-11b",
    name: "Grade 11 Chemistry",
    grade_level: "Grade 11",
    section: "B",
    academic_year: "2026-2027",
    student_count: 3,
    created_at: "2026-09-01T08:00:00Z",
  },
];

// Initial Seed Students
export const INITIAL_STUDENTS: Student[] = [
  {
    id: "stu-001",
    class_id: "cls-bio-10a",
    roll_number: "BIO-101",
    full_name: "Aiden Montgomery",
    email: "aiden.m@school.edu",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "stu-002",
    class_id: "cls-bio-10a",
    roll_number: "BIO-102",
    full_name: "Beatriz Morales",
    email: "beatriz.m@school.edu",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "stu-003",
    class_id: "cls-bio-10a",
    roll_number: "BIO-103",
    full_name: "Callum O'Connor",
    email: "callum.o@school.edu",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "stu-004",
    class_id: "cls-bio-10a",
    roll_number: "BIO-104",
    full_name: "Daria Rostova",
    email: "daria.r@school.edu",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "stu-005",
    class_id: "cls-bio-10a",
    roll_number: "BIO-105",
    full_name: "Ethan Wright",
    email: "ethan.w@school.edu",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "stu-006",
    class_id: "cls-chem-11b",
    roll_number: "CHM-201",
    full_name: "Fatima Al-Mansoor",
    email: "fatima.a@school.edu",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "stu-007",
    class_id: "cls-chem-11b",
    roll_number: "CHM-202",
    full_name: "Gabriel Santos",
    email: "gabriel.s@school.edu",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "stu-008",
    class_id: "cls-chem-11b",
    roll_number: "CHM-203",
    full_name: "Hannah Lindqvist",
    email: "hannah.l@school.edu",
    created_at: "2026-09-01T08:00:00Z",
  },
];

// Initial Seed Assessments
export const INITIAL_ASSESSMENTS: Assessment[] = [
  {
    id: "asm-bio-midterm",
    title: "Cellular Respiration & Photosynthesis Midterm",
    subject: "Biology",
    grade_level: "Grade 10",
    section: "A",
    class_id: "cls-bio-10a",
    max_marks: 30,
    status: "awaiting_review",
    date: "2026-10-10",
    question_paper_name: "Grade10_Bio_Midterm_Paper_2026.pdf",
    question_paper_path: "/uploads/reference/Grade10_Bio_Midterm_Paper_2026.pdf",
    marking_scheme_name: "Bio_Marking_Rubric_v2.pdf",
    marking_scheme_path: "/uploads/reference/Bio_Marking_Rubric_v2.pdf",
    total_scripts: 5,
    graded_scripts: 5,
    approved_scripts: 2,
    created_at: "2026-10-10T10:00:00Z",
  },
  {
    id: "asm-chem-kinetics",
    title: "Reaction Rates & Le Chatelier Principle Assessment",
    subject: "Chemistry",
    grade_level: "Grade 11",
    section: "B",
    class_id: "cls-chem-11b",
    max_marks: 25,
    status: "completed",
    date: "2026-10-04",
    question_paper_name: "Chem_Unit3_Exam.pdf",
    question_paper_path: "/uploads/reference/Chem_Unit3_Exam.pdf",
    marking_scheme_name: "Chem_Rubric_Official.pdf",
    marking_scheme_path: "/uploads/reference/Chem_Rubric_Official.pdf",
    total_scripts: 3,
    graded_scripts: 3,
    approved_scripts: 3,
    created_at: "2026-10-04T14:30:00Z",
  },
];

// Initial Questions for asm-bio-midterm
export const INITIAL_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "q-bio-1",
    assessment_id: "asm-bio-midterm",
    question_number: 1,
    question_text:
      "Explain the biochemical role of ATP Synthase in the inner mitochondrial membrane during oxidative phosphorylation.",
    max_marks: 10,
    rubric_criteria: [
      {
        id: "c1",
        criterion: "Identifies proton gradient across the inner mitochondrial membrane",
        marks: 3,
        guidance: "Must mention chemiosmosis or proton motive force",
      },
      {
        id: "c2",
        criterion: "Describes mechanical rotational catalysis coupling H+ flow to ADP + Pi condensation",
        marks: 4,
        guidance: "F0/F1 rotor explanation",
      },
      {
        id: "c3",
        criterion: "Correct biological terminology and thermodynamic rationale",
        marks: 3,
        guidance: "Exergonic dissipation driving endergonic ATP synthesis",
      },
    ],
    model_answer:
      "ATP Synthase utilizes the electrochemical proton gradient established by the electron transport chain. As protons flow down their concentration gradient through the F0 subunit, conformational rotation in the F1 subunit catalyzes the phosphorylation of ADP to produce ATP.",
  },
  {
    id: "q-bio-2",
    assessment_id: "asm-bio-midterm",
    question_number: 2,
    question_text:
      "Compare the light-dependent reactions with the Calvin Cycle regarding reactants, products, and cellular location.",
    max_marks: 10,
    rubric_criteria: [
      {
        id: "c4",
        criterion: "Thylakoid membrane vs Stroma locations identified accurately",
        marks: 3,
      },
      {
        id: "c5",
        criterion: "Light-dependent outputs (ATP, NADPH, O2) clearly linked to Calvin Cycle inputs",
        marks: 4,
      },
      {
        id: "c6",
        criterion: "Carbon fixation role of RuBisCO and G3P yield clearly described",
        marks: 3,
      },
    ],
    model_answer:
      "Light-dependent reactions occur in the thylakoid membranes using H2O and photons to generate ATP, NADPH, and O2 byproduct. The Calvin Cycle occurs in the chloroplast stroma, consuming ATP and NADPH along with CO2 via RuBisCO to synthesize G3P.",
  },
  {
    id: "q-bio-3",
    assessment_id: "asm-bio-midterm",
    question_number: 3,
    question_text:
      "Under anaerobic conditions in yeast, calculate the net ATP yield per mole of glucose and contrast with mammalian lactic fermentation.",
    max_marks: 10,
    rubric_criteria: [
      {
        id: "c7",
        criterion: "Calculates net 2 ATP from substrate-level phosphorylation in glycolysis",
        marks: 3,
      },
      {
        id: "c8",
        criterion: "Outlines ethanol and CO2 production in yeast via pyruvate decarboxylase and alcohol dehydrogenase",
        marks: 4,
      },
      {
        id: "c9",
        criterion: "Contrasts with single-step lactate dehydrogenase pathway in mammals without CO2 release",
        marks: 3,
      },
    ],
    model_answer:
      "Net ATP yield is 2 ATP via glycolysis. Yeast converts pyruvate to acetaldehyde (releasing CO2) then to ethanol to regenerate NAD+. Mammalian cells reduce pyruvate directly to lactate via LDH with no CO2 gas production.",
  },
];

// Initial Student Scripts
export const INITIAL_SCRIPTS: StudentScript[] = [
  {
    id: "scr-001",
    assessment_id: "asm-bio-midterm",
    student_id: "stu-001",
    student_name: "Aiden Montgomery",
    roll_number: "BIO-101",
    file_name: "Aiden_Montgomery_BioMidterm_Script.pdf",
    file_path: "/uploads/scripts/Aiden_Montgomery_BioMidterm_Script.pdf",
    file_size: 2451000,
    mime_type: "application/pdf",
    page_count: 3,
    status: "approved",
    total_score: 28,
    max_score: 30,
    percentage: 93.3,
    uploaded_at: "2026-10-10T11:00:00Z",
  },
  {
    id: "scr-002",
    assessment_id: "asm-bio-midterm",
    student_id: "stu-002",
    student_name: "Beatriz Morales",
    roll_number: "BIO-102",
    file_name: "Beatriz_Morales_BioMidterm_Script.pdf",
    file_path: "/uploads/scripts/Beatriz_Morales_BioMidterm_Script.pdf",
    file_size: 1980000,
    mime_type: "application/pdf",
    page_count: 2,
    status: "approved",
    total_score: 25.5,
    max_score: 30,
    percentage: 85.0,
    uploaded_at: "2026-10-10T11:05:00Z",
  },
  {
    id: "scr-003",
    assessment_id: "asm-bio-midterm",
    student_id: "stu-003",
    student_name: "Callum O'Connor",
    roll_number: "BIO-103",
    file_name: "Callum_OConnor_BioMidterm_Script.pdf",
    file_path: "/uploads/scripts/Callum_OConnor_BioMidterm_Script.pdf",
    file_size: 3200000,
    mime_type: "application/pdf",
    page_count: 3,
    status: "needs_review",
    total_score: 20,
    max_score: 30,
    percentage: 66.7,
    uploaded_at: "2026-10-10T11:10:00Z",
  },
  {
    id: "scr-004",
    assessment_id: "asm-bio-midterm",
    student_id: "stu-004",
    student_name: "Daria Rostova",
    roll_number: "BIO-104",
    file_name: "Daria_Rostova_BioMidterm_Script.pdf",
    file_path: "/uploads/scripts/Daria_Rostova_BioMidterm_Script.pdf",
    file_size: 2150000,
    mime_type: "application/pdf",
    page_count: 2,
    status: "graded",
    total_score: 27,
    max_score: 30,
    percentage: 90.0,
    uploaded_at: "2026-10-10T11:15:00Z",
  },
  {
    id: "scr-005",
    assessment_id: "asm-bio-midterm",
    student_id: "stu-005",
    student_name: "Ethan Wright",
    roll_number: "BIO-105",
    file_name: "Ethan_Wright_BioMidterm_Script.pdf",
    file_path: "/uploads/scripts/Ethan_Wright_BioMidterm_Script.pdf",
    file_size: 2840000,
    mime_type: "application/pdf",
    page_count: 3,
    status: "graded",
    total_score: 18.5,
    max_score: 30,
    percentage: 61.7,
    uploaded_at: "2026-10-10T11:20:00Z",
  },
];

// Initial Grading Results
export const INITIAL_GRADING_RESULTS: GradingResult[] = [
  // Aiden Montgomery (Approved)
  {
    id: "gr-001",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-001",
    question_id: "q-bio-1",
    student_id: "stu-001",
    proposed_score: 10,
    approved_score: 10,
    rationale: "Excellent mechanical description of F0 rotor and F1 stator with precise electrochemical potential terminology.",
    uncertainty_status: "high_confidence",
    confidence_score: 0.98,
    criteria_satisfied: ["c1", "c2", "c3"],
    feedback: "Exemplary answer with clear diagrams.",
    status: "approved",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "ATP Synthase functions through proton motive force across inner mitochondrial membrane...",
    script_page_index: 1,
    created_at: "2026-10-10T12:00:00Z",
    updated_at: "2026-10-10T14:00:00Z",
  },
  {
    id: "gr-002",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-001",
    question_id: "q-bio-2",
    student_id: "stu-001",
    proposed_score: 9,
    approved_score: 9,
    rationale: "Thylakoid and stroma locations accurate. Minor omission on exact NADPH recycling stoichiometry.",
    uncertainty_status: "high_confidence",
    confidence_score: 0.92,
    criteria_satisfied: ["c4", "c5"],
    feedback: "Solid comparison.",
    status: "approved",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "Light reactions happen on thylakoid membranes releasing O2 and synthesizing ATP/NADPH...",
    script_page_index: 2,
    created_at: "2026-10-10T12:00:00Z",
    updated_at: "2026-10-10T14:00:00Z",
  },
  {
    id: "gr-003",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-001",
    question_id: "q-bio-3",
    student_id: "stu-001",
    proposed_score: 9,
    approved_score: 9,
    rationale: "Correct 2 ATP net yield and differentiation between ethanolic and lactic fermentation.",
    uncertainty_status: "high_confidence",
    confidence_score: 0.95,
    criteria_satisfied: ["c7", "c8", "c9"],
    feedback: "Very thorough answer.",
    status: "approved",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "Net 2 ATP produced via substrate level phosphorylation in glycolysis...",
    script_page_index: 3,
    created_at: "2026-10-10T12:00:00Z",
    updated_at: "2026-10-10T14:00:00Z",
  },

  // Callum O'Connor (Needs Review - handwriting uncertainty)
  {
    id: "gr-007",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-003",
    question_id: "q-bio-1",
    student_id: "stu-003",
    proposed_score: 6.5,
    approved_score: null,
    rationale: "Identified proton flow, but chemical formula for ADP phosphorylation is partly obscured by heavy pencil smudging.",
    uncertainty_status: "high_uncertainty",
    confidence_score: 0.54,
    criteria_satisfied: ["c1"],
    feedback: "Flagged for teacher inspection: script subscript text is ambiguous.",
    status: "needs_review",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "Protons cross membrane through synth [smudged] causing rotation to make ATP...",
    script_page_index: 1,
    created_at: "2026-10-10T12:05:00Z",
    updated_at: "2026-10-10T12:05:00Z",
  },
  {
    id: "gr-008",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-003",
    question_id: "q-bio-2",
    student_id: "stu-003",
    proposed_score: 7,
    approved_score: null,
    rationale: "Accurately distinguished stroma from thylakoid; missing mention of RuBisCO enzyme catalyst.",
    uncertainty_status: "medium_confidence",
    confidence_score: 0.79,
    criteria_satisfied: ["c4", "c5"],
    feedback: "Review required.",
    status: "proposed",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "Thylakoid makes NADPH and ATP which transfer into the stroma for glucose...",
    script_page_index: 2,
    created_at: "2026-10-10T12:05:00Z",
    updated_at: "2026-10-10T12:05:00Z",
  },
  {
    id: "gr-009",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-003",
    question_id: "q-bio-3",
    student_id: "stu-003",
    proposed_score: 6.5,
    approved_score: null,
    rationale: "Calculated 2 ATP, but did not contrast mammalian lack of decarboxylation.",
    uncertainty_status: "high_confidence",
    confidence_score: 0.88,
    criteria_satisfied: ["c7", "c8"],
    feedback: "Review required.",
    status: "proposed",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "Glycolysis yields 2 ATP net. Yeast makes CO2 and ethanol...",
    script_page_index: 3,
    created_at: "2026-10-10T12:05:00Z",
    updated_at: "2026-10-10T12:05:00Z",
  },

  // Daria Rostova (Graded, Proposed)
  {
    id: "gr-010",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-004",
    question_id: "q-bio-1",
    student_id: "stu-004",
    proposed_score: 9.5,
    approved_score: null,
    rationale: "Thorough discussion of chemiosmosis, proton gradient, and F0/F1 rotary motor mechanism.",
    uncertainty_status: "high_confidence",
    confidence_score: 0.96,
    criteria_satisfied: ["c1", "c2", "c3"],
    feedback: "Ready for teacher sign-off.",
    status: "proposed",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "Proton motive force generated by complexes I-IV drives proton influx through F0 rotor...",
    script_page_index: 1,
    created_at: "2026-10-10T12:10:00Z",
    updated_at: "2026-10-10T12:10:00Z",
  },
  {
    id: "gr-011",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-004",
    question_id: "q-bio-2",
    student_id: "stu-004",
    proposed_score: 8.5,
    approved_score: null,
    rationale: "Good comparison table layout; minor omission of oxygen evolving complex detail.",
    uncertainty_status: "high_confidence",
    confidence_score: 0.91,
    criteria_satisfied: ["c4", "c5", "c6"],
    feedback: "Ready for teacher sign-off.",
    status: "proposed",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "Light reactions: Thylakoid lumen/membrane. Calvin cycle: Chloroplast stroma...",
    script_page_index: 2,
    created_at: "2026-10-10T12:10:00Z",
    updated_at: "2026-10-10T12:10:00Z",
  },
  {
    id: "gr-012",
    assessment_id: "asm-bio-midterm",
    script_id: "scr-004",
    question_id: "q-bio-3",
    student_id: "stu-004",
    proposed_score: 9.0,
    approved_score: null,
    rationale: "Correct calculation and reaction pathways for yeast and human muscle cells.",
    uncertainty_status: "high_confidence",
    confidence_score: 0.94,
    criteria_satisfied: ["c7", "c8", "c9"],
    feedback: "Ready for teacher sign-off.",
    status: "proposed",
    is_mock: true,
    edited_by_teacher: false,
    answer_extracted_text: "Net 2 ATP per glucose. Yeast produces CO2 + ethanol; mammals produce lactate directly...",
    script_page_index: 3,
    created_at: "2026-10-10T12:10:00Z",
    updated_at: "2026-10-10T12:10:00Z",
  },
];

/**
 * Data Repository Singleton
 * Keeps in-memory/localStorage state synchronized and provides standard CRUD operations.
 */
class Repository {
  private profile: TeacherProfile = { ...INITIAL_PROFILE };
  private classes: ClassGroup[] = [...INITIAL_CLASSES];
  private students: Student[] = [...INITIAL_STUDENTS];
  private assessments: Assessment[] = [...INITIAL_ASSESSMENTS];
  private questions: AssessmentQuestion[] = [...INITIAL_QUESTIONS];
  private scripts: StudentScript[] = [...INITIAL_SCRIPTS];
  private results: GradingResult[] = [...INITIAL_GRADING_RESULTS];

  // Profile / Settings
  getProfile(): TeacherProfile {
    return { ...this.profile };
  }

  updateProfile(updates: Partial<TeacherProfile>): TeacherProfile {
    this.profile = { ...this.profile, ...updates };
    return { ...this.profile };
  }

  // Classes
  getClasses(): ClassGroup[] {
    return this.classes.map((cls) => {
      const count = this.students.filter((s) => s.class_id === cls.id).length;
      return { ...cls, student_count: count };
    });
  }

  getClass(id: string): ClassGroup | undefined {
    const cls = this.classes.find((c) => c.id === id);
    if (!cls) return undefined;
    const count = this.students.filter((s) => s.class_id === cls.id).length;
    return { ...cls, student_count: count };
  }

  createClass(data: Omit<ClassGroup, "id" | "created_at" | "student_count">): ClassGroup {
    const newClass: ClassGroup = {
      ...data,
      id: `cls-${Date.now()}`,
      student_count: 0,
      created_at: new Date().toISOString(),
    };
    this.classes.push(newClass);
    return newClass;
  }

  updateClass(id: string, updates: Partial<ClassGroup>): ClassGroup {
    const idx = this.classes.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Class not found");
    this.classes[idx] = { ...this.classes[idx], ...updates };
    return this.getClass(id)!;
  }

  deleteClass(id: string): void {
    this.classes = this.classes.filter((c) => c.id !== id);
    this.students = this.students.filter((s) => s.class_id !== id);
  }

  // Students
  getStudents(classId?: string): Student[] {
    if (classId) {
      return this.students.filter((s) => s.class_id === classId);
    }
    return [...this.students];
  }

  getStudent(id: string): Student | undefined {
    return this.students.find((s) => s.id === id);
  }

  createStudent(data: Omit<Student, "id" | "created_at">): Student {
    const newStudent: Student = {
      ...data,
      id: `stu-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.students.push(newStudent);
    return newStudent;
  }

  updateStudent(id: string, updates: Partial<Student>): Student {
    const idx = this.students.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Student not found");
    this.students[idx] = { ...this.students[idx], ...updates };
    return { ...this.students[idx] };
  }

  deleteStudent(id: string): void {
    this.students = this.students.filter((s) => s.id !== id);
    this.scripts = this.scripts.filter((scr) => scr.student_id !== id);
    this.results = this.results.filter((res) => res.student_id !== id);
  }

  // Assessments
  getAssessments(): Assessment[] {
    return [...this.assessments];
  }

  getAssessment(id: string): Assessment | undefined {
    return this.assessments.find((a) => a.id === id);
  }

  createAssessment(data: {
    title: string;
    subject: string;
    grade_level: string;
    section: string;
    class_id?: string;
    max_marks: number;
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
  }): Assessment {
    const newAssessment: Assessment = {
      id: `asm-${Date.now()}`,
      title: data.title,
      subject: data.subject,
      grade_level: data.grade_level,
      section: data.section,
      class_id: data.class_id,
      max_marks: data.max_marks,
      status: "draft",
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
    this.assessments.push(newAssessment);

    if (data.questions && data.questions.length > 0) {
      data.questions.forEach((q) => {
        this.questions.push({
          id: `q-${newAssessment.id}-${q.question_number}`,
          assessment_id: newAssessment.id,
          question_number: q.question_number,
          question_text: q.question_text,
          max_marks: q.max_marks,
          rubric_criteria: q.rubric_criteria || [],
        });
      });
    }

    return newAssessment;
  }

  updateAssessment(id: string, updates: Partial<Assessment>): Assessment {
    const idx = this.assessments.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Assessment not found");
    this.assessments[idx] = { ...this.assessments[idx], ...updates };
    return { ...this.assessments[idx] };
  }

  deleteAssessment(id: string): void {
    this.assessments = this.assessments.filter((a) => a.id !== id);
    this.questions = this.questions.filter((q) => q.assessment_id !== id);
    this.scripts = this.scripts.filter((s) => s.assessment_id !== id);
    this.results = this.results.filter((r) => r.assessment_id !== id);
  }

  // Questions
  getQuestions(assessmentId: string): AssessmentQuestion[] {
    return this.questions
      .filter((q) => q.assessment_id === assessmentId)
      .sort((a, b) => a.question_number - b.question_number);
  }

  addQuestion(data: Omit<AssessmentQuestion, "id">): AssessmentQuestion {
    const q: AssessmentQuestion = {
      ...data,
      id: `q-${Date.now()}-${data.question_number}`,
    };
    this.questions.push(q);
    return q;
  }

  // Scripts
  getScripts(assessmentId: string): StudentScript[] {
    return this.scripts.filter((s) => s.assessment_id === assessmentId);
  }

  getScript(id: string): StudentScript | undefined {
    return this.scripts.find((s) => s.id === id);
  }

  addScript(data: Omit<StudentScript, "id" | "uploaded_at">): StudentScript {
    const script: StudentScript = {
      ...data,
      id: `scr-${Date.now()}`,
      uploaded_at: new Date().toISOString(),
    };
    this.scripts.push(script);

    // Update assessment script count
    const asm = this.getAssessment(data.assessment_id);
    if (asm) {
      this.updateAssessment(asm.id, {
        total_scripts: this.getScripts(asm.id).length,
      });
    }

    return script;
  }

  // Grading Results
  getGradingResults(assessmentId: string, scriptId?: string): GradingResult[] {
    let list = this.results.filter((r) => r.assessment_id === assessmentId);
    if (scriptId) {
      list = list.filter((r) => r.script_id === scriptId);
    }
    return list;
  }

  updateGradingResult(
    resultId: string,
    updates: {
      approved_score?: number | null;
      feedback?: string;
      status?: "draft" | "proposed" | "needs_review" | "approved";
      edited_by_teacher?: boolean;
    }
  ): GradingResult {
    const idx = this.results.findIndex((r) => r.id === resultId);
    if (idx === -1) throw new Error("Grading result not found");

    const existing = this.results[idx];

    // If updating approved score, perform strict boundary check
    if (updates.approved_score !== undefined && updates.approved_score !== null) {
      const q = this.questions.find((question) => question.id === existing.question_id);
      const max = q?.max_marks || 10;
      const validation = validateScoreBounds(updates.approved_score, max);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    const updated: GradingResult = {
      ...existing,
      ...updates,
      edited_by_teacher: updates.edited_by_teacher !== undefined ? updates.edited_by_teacher : true,
      updated_at: new Date().toISOString(),
    };

    this.results[idx] = updated;

    // Recalculate script totals deterministically
    this.recalculateScriptTotals(existing.script_id);

    return updated;
  }

  approveGradingResult(resultId: string, finalScore?: number): GradingResult {
    const target = this.results.find((r) => r.id === resultId);
    if (!target) throw new Error("Grading result not found");

    const scoreToApprove = finalScore !== undefined ? finalScore : (target.approved_score ?? target.proposed_score);

    return this.updateGradingResult(resultId, {
      approved_score: scoreToApprove,
      status: "approved",
      edited_by_teacher: finalScore !== undefined,
    });
  }

  approveAllResultsForScript(scriptId: string): void {
    const scriptResults = this.results.filter((r) => r.script_id === scriptId);
    for (const res of scriptResults) {
      const score = res.approved_score ?? res.proposed_score;
      this.updateGradingResult(res.id, {
        approved_score: score,
        status: "approved",
      });
    }
    const scr = this.getScript(scriptId);
    if (scr) {
      const idx = this.scripts.findIndex((s) => s.id === scriptId);
      if (idx !== -1) {
        this.scripts[idx] = { ...this.scripts[idx], status: "approved" };
      }
    }
  }

  private recalculateScriptTotals(scriptId: string): void {
    const scr = this.getScript(scriptId);
    if (!scr) return;

    const scriptResults = this.results.filter((r) => r.script_id === scriptId);
    const questions = this.getQuestions(scr.assessment_id);

    const questionScores = questions.map((q) => {
      const res = scriptResults.find((r) => r.question_id === q.id);
      const effectiveScore = res ? (res.approved_score ?? res.proposed_score) : null;
      return { score: effectiveScore, max: q.max_marks };
    });

    const totals = calculateStudentTotals(questionScores, undefined, this.profile.rounding_mode);

    const idx = this.scripts.findIndex((s) => s.id === scriptId);
    if (idx !== -1) {
      this.scripts[idx] = {
        ...this.scripts[idx],
        total_score: totals.rawTotal,
        percentage: totals.percentage,
      };
    }
  }

  // Markbook Matrix Computation
  getMarkbook(assessmentId: string, targetScaleMax?: number): {
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
    const assessment = this.getAssessment(assessmentId);
    if (!assessment) throw new Error("Assessment not found");

    const questions = this.getQuestions(assessmentId);
    const scripts = this.getScripts(assessmentId);
    const results = this.getGradingResults(assessmentId);

    // Get all students enrolled in class or who have a script
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

      const totals = calculateStudentTotals(scoreItems, targetScaleMax, this.profile.rounding_mode);

      // Determine overall student approval status
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

    // Compute stats deterministically
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
      const script = this.scripts.find(
        (s) => s.assessment_id === asm.id && s.student_id === student.id
      );

      const hasScript = Boolean(script && script.total_score !== null);
      const rawScore = hasScript ? script!.total_score : null;
      const percentage = hasScript && asm.max_marks > 0 && rawScore !== null
        ? Math.round((rawScore / asm.max_marks) * 1000) / 10
        : null;

      const gradeInfo = resolveGradeBand(percentage, this.profile.grade_bands);

      return {
        assessment: asm,
        raw_score: rawScore,
        max_marks: asm.max_marks,
        percentage,
        converted_marks: percentage, // percentage scale (100)
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

    const overallBand = resolveGradeBand(overallPct, this.profile.grade_bands);

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

  // Seed Reset Action
  resetToDefaultSeed(): void {
    this.profile = { ...INITIAL_PROFILE };
    this.classes = [...INITIAL_CLASSES];
    this.students = [...INITIAL_STUDENTS];
    this.assessments = [...INITIAL_ASSESSMENTS];
    this.questions = [...INITIAL_QUESTIONS];
    this.scripts = [...INITIAL_SCRIPTS];
    this.results = [...INITIAL_GRADING_RESULTS];
  }
}

export const repository = new Repository();
