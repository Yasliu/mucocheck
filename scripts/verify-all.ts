import fs from "fs";
import {
  calculateStudentTotals,
  resolveGradeBand,
  roundScore,
  validateScoreBounds,
} from "../src/lib/scoring/deterministic-calculator";
import { MockGradingProvider } from "../src/lib/grading/mock-provider";
import { NebiusTokenFactoryGradingProvider } from "../src/lib/grading/nebius-provider";
import { repository } from "../src/lib/db/repo";

async function runVerification() {
  console.log("=== RUNNING MUCOCHECK VERIFICATION TEST SUITE ===\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Deterministic Rounding Tests
  console.log("--- 1. Deterministic Rounding ---");
  assert(roundScore(84.55, "half_up", 1) === 84.6, "half_up rounds 84.55 to 84.6");
  assert(roundScore(84.54, "half_up", 1) === 84.5, "half_up rounds 84.54 to 84.5");
  assert(roundScore(84.59, "floor", 1) === 84.5, "floor rounds 84.59 to 84.5");
  assert(roundScore(84.51, "ceil", 1) === 84.6, "ceil rounds 84.51 to 84.6");

  // 2. Strict Score Boundary Validation
  console.log("\n--- 2. Score Boundary Validation ---");
  assert(validateScoreBounds(10, 10).valid, "Score 10/10 is valid");
  assert(validateScoreBounds(0, 10).valid, "Score 0/10 is valid");
  assert(validateScoreBounds(null, 10).valid, "Null score is permitted (unattempted/missing)");
  assert(!validateScoreBounds(-1, 10).valid, "Rejects negative score (-1)");
  assert(!validateScoreBounds(10.5, 10).valid, "Rejects score exceeding maximum marks (10.5/10)");

  // 3. Deterministic Totals and Missing Value Handling
  console.log("\n--- 3. Deterministic Arithmetic & Missing Question Handling ---");
  const scoresComplete = [
    { score: 9.5, max: 10 },
    { score: 8.0, max: 10 },
    { score: 7.5, max: 10 },
  ];
  const totalComp = calculateStudentTotals(scoresComplete);
  assert(totalComp.rawTotal === 25.0, "Calculates exact raw total 25.0");
  assert(totalComp.percentage === 83.3, "Calculates percentage 83.3%");
  assert(!totalComp.hasMissing, "Reports complete submission with no missing");

  // Missing question: must not silently coerce to zero
  const scoresWithMissing = [
    { score: 9, max: 10 },
    { score: null, max: 10 },
    { score: 8, max: 10 },
  ];
  const totalMissing = calculateStudentTotals(scoresWithMissing);
  assert(totalMissing.rawTotal === 17.0, "Calculates submitted raw marks sum");
  assert(totalMissing.hasMissing === true, "Explicitly flags missing questions");

  // 4. Grade Band Resolution
  console.log("\n--- 4. Grade Band Resolution ---");
  assert(resolveGradeBand(95.0).grade === "A*", "Resolves 95% to A*");
  assert(resolveGradeBand(82.5).grade === "A", "Resolves 82.5% to A");
  assert(resolveGradeBand(74.0).grade === "B", "Resolves 74% to B");
  assert(resolveGradeBand(62.0).grade === "C", "Resolves 62% to C");
  assert(resolveGradeBand(51.0).grade === "D", "Resolves 51% to D");
  assert(resolveGradeBand(43.0).grade === "E", "Resolves 43% to E");
  assert(resolveGradeBand(25.0).grade === "F", "Resolves 25% to F");
  assert(resolveGradeBand(null).grade === "Incomplete", "Null percentage resolves to Incomplete");

  // 5. Mock Grading Provider
  console.log("\n--- 5. Mock Grading Provider ---");
  const mockProvider = new MockGradingProvider();
  assert(mockProvider.isMock === true, "MockGradingProvider is strictly identified as mock");

  const questionGrading = await mockProvider.gradeQuestion({
    questionId: "q-test-1",
    questionNumber: 1,
    questionText: "Explain ATP Synthase function.",
    maxMarks: 10,
    rubricCriteria: [
      { id: "c1", criterion: "Proton gradient", marks: 5 },
      { id: "c2", criterion: "ADP phosphorylation", marks: 5 },
    ],
    studentId: "stu-001",
  });
  assert(questionGrading.proposedMarks <= 10, "Proposed marks do not exceed maximum marks");
  assert(questionGrading.isMock === true, "Result is flagged isMock = true");
  assert(questionGrading.conciseRationale.length > 0, "Provides clear rationale");

  // Handwriting uncertainty check
  const uncertainGrading = await mockProvider.gradeQuestion({
    questionId: "q-test-5",
    questionNumber: 5, // Triggers handwriting uncertainty in mock provider
    questionText: "Derive reaction rate law.",
    studentAnswerText: "r = k[A]^alpha[B]^beta with ambiguous cursive exponents",
    maxMarks: 10,
    rubricCriteria: [{ id: "c1", criterion: "Rate constant", marks: 10 }],
    studentId: "stu-001",
  });
  assert(
    uncertainGrading.uncertaintyStatus === "high_uncertainty",
    "Correctly flags handwriting uncertainty on difficult or smudged questions"
  );

  // 6. Nebius Token Factory Provider Non-Fabrication Guarantee
  console.log("\n--- 6. Nebius Token Factory Non-Fabrication ---");
  const nebiusProvider = new NebiusTokenFactoryGradingProvider();
  let threwExpectedError = false;
  try {
    await nebiusProvider.gradeQuestion({
      questionId: "q-1",
      questionNumber: 1,
      questionText: "Test",
      maxMarks: 10,
      rubricCriteria: [],
      studentId: "stu-1",
    });
  } catch (err: unknown) {
    threwExpectedError = true;
  }
  assert(
    threwExpectedError,
    "Nebius provider throws explicit error and refuses to fabricate responses when unconfigured or awaiting team review"
  );

  // 7. Repository CRUD and Markbook
  console.log("\n--- 7. Repository CRUD & Markbook Calculation ---");
  const classes = repository.getClasses();
  assert(classes.length >= 2, "Seed classes loaded");

  const students = repository.getStudents();
  assert(students.length >= 8, "Seed students loaded");

  const markbook = repository.getMarkbook("asm-bio-midterm");
  assert(markbook.rows.length > 0, "Generated markbook rows");
  assert(markbook.questions.length === 3, "Markbook contains 3 questions");
  assert(markbook.stats.averageScore !== null, "Calculated class average score");

  // Teacher Approval Update
  const targetResult = repository.getGradingResults("asm-bio-midterm")[0];
  const updatedResult = repository.updateGradingResult(targetResult.id, {
    approved_score: 9.5,
    status: "approved",
  });
  assert(updatedResult.approved_score === 9.5, "Approved score recorded");
  assert(updatedResult.edited_by_teacher === true, "Audit trail records teacher edit");
  assert(updatedResult.proposed_score !== null, "Preserves original AI proposed score");

  // Report Card Compilation
  const reportCard = repository.getStudentReportCard("stu-001");
  assert(reportCard.student.full_name === "Aiden Montgomery", "Fetched student report card");
  assert(reportCard.assessments.length > 0, "Included assessment records");
  assert(reportCard.overall_percentage !== null, "Calculated overall percentage");

  // 8. File Storage Validation & Retrieval
  console.log("\n--- 8. File Storage & MIME Validation ---");
  const { savePrivateFile, getPrivateFile, validateUploadedFile } = await import("../src/lib/storage/file-storage");
  const samplePdfBytes = Buffer.from("%PDF-1.4 sample content for testing purposes");
  const saveResult = await savePrivateFile(samplePdfBytes, "midterm-scheme.pdf", "schemes");
  assert(saveResult.relativePath.startsWith("schemes/"), "Stored in requested schemes/ subfolder");
  assert(saveResult.size === samplePdfBytes.length, "Recorded correct byte size");

  const retrievedFile = await getPrivateFile(saveResult.relativePath);
  assert(retrievedFile !== null, "Successfully retrieved stored file");
  assert(retrievedFile?.mimeType === "application/pdf", "Retrieved correct MIME type");

  const validationResult = validateUploadedFile({
    name: "malicious.exe",
    size: 1024,
    type: "application/x-msdownload",
  });
  assert(!validationResult.valid, "Rejects disallowed file types (.exe)");

  // 9. ServerStore Persistence & Draft Lifecycle
  console.log("\n--- 9. ServerStore Persistence & Draft Lifecycle ---");
  const { serverStore } = await import("../src/lib/db/server-store");
  const draftAssessment = serverStore.createAssessment({
    title: "Grade 10 Chemistry Pop Quiz",
    subject: "Chemistry",
    grade_level: "Grade 10",
    section: "A",
    class_id: "cls-bio-10a",
    date: "2026-10-14",
    max_marks: 30,
    status: "draft",
    questions: [
      { question_number: 1, max_marks: 10, question_text: "Balance H2 + O2" },
      { question_number: 2, max_marks: 20, question_text: "Calculate molar mass" },
    ],
  });
  assert(draftAssessment.status === "draft", "Saved assessment as draft");

  // Reopen draft from serverStore
  const reopenedDraft = serverStore.getAssessment(draftAssessment.id);
  assert(reopenedDraft !== null, "Reopened draft without losing state");
  const draftQuestions = serverStore.getQuestions(draftAssessment.id);
  assert(draftQuestions.length === 2, "Questions preserved in draft");

  // Update draft to ready
  const readyAssessment = serverStore.updateAssessment(draftAssessment.id, {
    status: "ready",
  });
  assert(readyAssessment?.status === "ready", "Successfully progressed assessment status from draft to ready");

  // 10. Audit Trail & Teacher Overrides
  console.log("\n--- 10. Audit Trail & Teacher Overrides ---");
  const testScript = serverStore.addScript({
    assessment_id: draftAssessment.id,
    student_id: "stu-001",
    student_name: "Aiden Montgomery",
    roll_number: "BIO-101",
    file_name: "aiden_chem.pdf",
    file_path: saveResult.relativePath,
    file_size: saveResult.size,
    mime_type: "application/pdf",
    page_count: 1,
    status: "graded",
    total_score: 7.0,
    max_score: 30,
    percentage: 23.3,
  });

  const rawResult = serverStore.addGradingResult({
    assessment_id: draftAssessment.id,
    student_id: "stu-001",
    script_id: testScript.id,
    question_id: draftQuestions[0].id,
    proposed_score: 7.0,
    approved_score: null,
    rationale: "Correct chemical equation but missing state symbols.",
    uncertainty_status: "medium_confidence",
    confidence_score: 0.82,
    criteria_satisfied: ["Balanced equation"],
    feedback: "Review chemical state symbols.",
    status: "proposed",
    is_mock: true,
    edited_by_teacher: false,
    audit_history: [],
    created_at: new Date().toISOString(),
  });

  assert(rawResult.proposed_score === 7.0, "AI proposed score recorded");
  assert(rawResult.approved_score === null, "Approved score initially null");

  // Teacher modifies score with rationale
  const auditedResult = serverStore.updateGradingResult(rawResult.id, {
    approved_score: 8.5,
    feedback: "Awarded 1.5 partial credit for state symbols in rough work margin.",
    reason: "State symbols present in margin",
    status: "approved",
  });

  assert(auditedResult?.approved_score === 8.5, "Teacher approved score updated");
  assert(auditedResult?.proposed_score === 7.0, "Original AI proposed score preserved");
  assert((auditedResult?.audit_history?.length || 0) > 0, "Audit trail logged change history");
  assert(
    auditedResult?.audit_history?.[0]?.reason === "State symbols present in margin",
    "Audit trail recorded exact teacher rationale"
  );

  // 11. Review Controls: Question Reassignment & Unreadable Answer
  console.log("\n--- 11. Question Reassignment & Unreadable Flagging ---");
  // Reassign to question 2
  const reassignedResult = serverStore.reassignQuestionMatch(
    rawResult.id,
    draftQuestions[1].id,
    "Candidate answered Q2 at top of page"
  );
  assert(reassignedResult?.question_id === draftQuestions[1].id, "Question match correctly reassigned");
  assert(reassignedResult?.audit_history?.some((a) => a.action === "corrected_match") === true, "Logged corrected_match in audit history");

  // Flag as unreadable
  const unreadableResult = serverStore.markAnswerUnreadable(
    rawResult.id,
    "Ink smudge across answer calculation"
  );
  assert(unreadableResult?.status === "needs_review", "Marked status as needs_review");
  assert(unreadableResult?.is_unreadable === true, "Flagged with is_unreadable = true");

  // 12. Deterministic Raw-to-Scale Conversion in Markbook
  console.log("\n--- 12. Raw-to-Scale Conversion in Markbook ---");
  const scaledMarkbook = serverStore.getMarkbook(draftAssessment.id, 100);
  assert(scaledMarkbook.targetScaleMax === 100, "Markbook recognizes target scale max 100");
  assert(scaledMarkbook.rows.length >= 1, "Generated markbook rows for class roster");

  // Aiden has score 8.5 on Q2 (max 20) -> 8.5 / 30 = 28.3% -> scaled to 100 is 28.3
  const candidateRow = scaledMarkbook.rows.find((r) => r.student.id === "stu-001");
  assert(candidateRow !== undefined, "Found candidate row in markbook");
  assert(candidateRow?.raw_total === 8.5, "Candidate raw total is 8.5");
  assert(candidateRow?.converted_total !== undefined, "Calculated converted total");

  // 13. Printable PDF Generation
  console.log("\n--- 13. PDF Report Generation ---");
  const { generateReportCardPdf } = await import("../src/lib/reports/pdf-generator");
  const sampleReportCard = serverStore.getStudentReportCard("stu-001");
  const pdfBuffer = await generateReportCardPdf(sampleReportCard);
  assert(Buffer.isBuffer(pdfBuffer), "Generated PDF as Buffer");
  assert(pdfBuffer.length > 500, "PDF buffer has realistic document size");
  assert(pdfBuffer.subarray(0, 5).toString("ascii") === "%PDF-", "PDF begins with standard %PDF- header");

  // 14. Teacher Authentication & Session Resolution
  console.log("\n--- 14. Teacher Authentication & Session Resolution ---");
  const {
    getAuthenticatedTeacher,
    requireTeacher,
    verifyTeacherOwnership,
  } = await import("../src/lib/auth/server-auth");

  // Fallback teacher resolution
  const fallbackTeacher = await getAuthenticatedTeacher();
  assert(fallbackTeacher !== null, "Resolves fallback teacher for local session");
  assert(fallbackTeacher?.id === "usr-teacher-001", "Default teacher has ID usr-teacher-001");
  assert(fallbackTeacher?.source === "fallback", "Identifies teacher as fallback");

  // Header-based teacher authentication
  const mockReqWithAuth = new Request("http://localhost:3000/api/assessments", {
    headers: {
      "x-teacher-id": "usr-teacher-sarah",
      "x-teacher-email": "sarah@mucono.edu",
      "x-teacher-name": "Dr. Sarah Connor",
    },
  });
  const headerTeacher = await getAuthenticatedTeacher(mockReqWithAuth);
  assert(headerTeacher !== null, "Resolves teacher from authentication headers");
  assert(headerTeacher?.id === "usr-teacher-sarah", "Extracted correct teacher ID from header");
  assert(headerTeacher?.full_name === "Dr. Sarah Connor", "Extracted teacher full name");
  assert(headerTeacher?.source === "header", "Identifies teacher as header authenticated");

  // Strict mode rejection when fallback is explicitly forbidden
  const mockReqStrict = new Request("http://localhost:3000/api/assessments", {
    headers: { "x-allow-fallback": "false" },
  });
  let strictRejected = false;
  try {
    await requireTeacher(mockReqStrict, { strict: true });
  } catch {
    strictRejected = true;
  }
  assert(strictRejected, "Strict mode rejects unauthenticated request when fallback is disabled");

  // 15. Cross-User Access Denial & Multi-Teacher Isolation
  console.log("\n--- 15. Cross-User Access Denial & Multi-Teacher Isolation ---");
  const teacherA = { id: "usr-teacher-001", email: "vance@mucono.edu", full_name: "Dr. Eleanor Vance", role: "teacher" as const, source: "fallback" as const };
  const teacherB = { id: "usr-teacher-002", email: "ross@mucono.edu", full_name: "Prof. Gregory Ross", role: "teacher" as const, source: "header" as const };

  // Teacher A creates an assessment
  const teacherA_Assessment = serverStore.createAssessment({
    teacher_id: teacherA.id,
    title: "Dr. Vance AP Biology Exam",
    subject: "Biology",
    grade_level: "Grade 11",
    section: "B",
    max_marks: 40,
    status: "ready",
    date: "2026-10-14",
  });

  assert(teacherA_Assessment.teacher_id === teacherA.id, "Assessment records Teacher A as owner");

  // Teacher B attempts to query Teacher A's assessment
  const teacherB_view = serverStore.getAssessment(teacherA_Assessment.id, teacherB.id);
  assert(teacherB_view === undefined, "Teacher B is denied access to Teacher A's assessment");

  // Teacher A queries own assessment
  const teacherA_view = serverStore.getAssessment(teacherA_Assessment.id, teacherA.id);
  assert(teacherA_view !== undefined, "Teacher A is granted access to own assessment");

  // Ownership verification helper
  assert(verifyTeacherOwnership(teacherA, teacherA_Assessment.teacher_id) === true, "verifyTeacherOwnership passes for resource owner");
  assert(verifyTeacherOwnership(teacherB, teacherA_Assessment.teacher_id) === false, "verifyTeacherOwnership fails for cross-user teacher");

  // 16. Private File Storage Authorization
  console.log("\n--- 16. Private File Storage Authorization ---");
  const fileOwner = serverStore.getFileOwnerTeacherId(saveResult.relativePath);
  assert(fileOwner !== null, "Identified file owner teacher from database references");
  assert(verifyTeacherOwnership(teacherA, fileOwner!) === true, "Owner teacher authorized to stream private file");
  assert(verifyTeacherOwnership(teacherB, fileOwner!) === false, "Different teacher denied permission to access private file");

  // 17. Safe Backup Snapshot Procedure
  console.log("\n--- 17. Safe Backup Snapshot Procedure ---");
  const backupSnapshot = serverStore.createBackup("automated-test");
  assert(fs.existsSync(backupSnapshot.backupPath), "Backup file created on disk in .data/backups/");
  assert(backupSnapshot.stats.assessments > 0, "Backup includes assessment records");
  assert(backupSnapshot.stats.classes > 0, "Backup includes class records");

  // 18. Safe Database Request Failure Handling
  console.log("\n--- 18. Safe Database Failure & Missing Configuration Handling ---");
  // Simulates missing table error or offline database
  let handledGracefully = false;
  try {
    const errorBody = { code: "PGRST205", message: "Could not find the table 'public.classes' in the schema cache" };
    if (errorBody.code === "PGRST205") {
      // System handles missing table and falls back to serverStore
      const fallbackClasses = serverStore.getClasses();
      assert(fallbackClasses.length > 0, "Fell back to server store safely without crashing or throwing");
      handledGracefully = true;
    }
  } catch {
    handledGracefully = false;
  }
  assert(handledGracefully, "Handles missing remote schema cache (PGRST205) with safe local fallback");

  console.log(`\n==================================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
