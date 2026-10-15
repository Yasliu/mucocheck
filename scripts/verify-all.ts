(process.env as any).NODE_ENV = process.env.NODE_ENV || "test";
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
import {
  checkCambridgeMarkRules,
  computeSourceFingerprint,
  flattenLeafQuestionNodes,
  calculateMapTotalMarks,
  evaluateMapFreshness,
  validateUnderstandingMap,
} from "../src/lib/understanding/validator";
import {
  AssessmentUnderstandingMap,
  UnderstandingMapQuestionNode,
} from "../src/lib/understanding/types";

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

  // 14. Teacher Authentication & Production Security
  console.log("\n--- 14. Teacher Authentication & Production Security ---");
  const {
    getAuthenticatedTeacher,
    requireTeacher,
    verifyTeacherOwnership,
    isDevAuthAllowed,
  } = await import("../src/lib/auth/server-auth");

  // In test/dev environment, dev bypass is permitted
  assert(isDevAuthAllowed() === true, "isDevAuthAllowed permits test/dev mode in non-production");

  // Synthetic dev test identity
  const mockDevTestReq = new Request("http://localhost:3000/api/assessments", {
    headers: {
      "x-dev-test-teacher-id": "usr-teacher-sarah",
      "x-dev-test-teacher-email": "sarah@mucono.edu",
      "x-dev-test-teacher-name": "Dr. Sarah Connor",
    },
  });
  const devTestTeacher = await getAuthenticatedTeacher(mockDevTestReq);
  assert(devTestTeacher !== null, "Resolves synthetic teacher in dev/test mode");
  assert(devTestTeacher?.id === "usr-teacher-sarah", "Extracted test teacher ID");
  assert(devTestTeacher?.source === "dev_mode", "Identifies teacher source as dev_mode");

  // Caller-supplied x-teacher-id header is NEVER trusted
  const untrustedHeaderReq = new Request("http://localhost:3000/api/assessments", {
    headers: {
      "x-teacher-id": "attacker-spoofed-id",
    },
  });
  const untrustedResult = await getAuthenticatedTeacher(untrustedHeaderReq);
  assert(untrustedResult?.id !== "attacker-spoofed-id", "Never trusts caller-supplied x-teacher-id header");

  // PRODUCTION MODE SIMULATION: Strict rejection without valid Supabase session
  const origNodeEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "production";

  assert(isDevAuthAllowed() === false, "isDevAuthAllowed is strictly false in production");

  const prodUnauthReq = new Request("http://localhost:3000/api/assessments");
  const prodTeacher = await getAuthenticatedTeacher(prodUnauthReq);
  assert(prodTeacher === null, "Production strictly returns null for unauthenticated requests");

  let prodRequireThrew = false;
  try {
    await requireTeacher(prodUnauthReq);
  } catch (err: any) {
    prodRequireThrew = true;
    assert(err.message === "UNAUTHORIZED", "Production requireTeacher throws UNAUTHORIZED");
  }
  assert(prodRequireThrew, "requireTeacher fails closed in production");

  // Restore NODE_ENV
  (process.env as any).NODE_ENV = origNodeEnv;

  // 15. Cross-User Access Denial & Multi-Teacher Isolation
  console.log("\n--- 15. Cross-User Access Denial & Multi-Teacher Isolation ---");
  const teacherA = { id: "usr-teacher-001", email: "vance@mucono.edu", full_name: "Dr. Eleanor Vance", role: "teacher" as const, source: "fallback" as const };
  const teacherB = { id: "usr-teacher-002", email: "ross@mucono.edu", full_name: "Prof. Gregory Ross", role: "teacher" as const, source: "dev_mode" as const };

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

  // 16. Private File Storage Authorization & Bucket Mapping
  console.log("\n--- 16. Private File Storage Authorization & Bucket Mapping ---");
  const { getStorageBucket } = await import("../src/lib/storage/file-storage");
  assert(getStorageBucket("scripts") === "scripts", "Maps scripts category to 'scripts' bucket");
  assert(getStorageBucket("papers") === "reference_docs", "Maps papers category to 'reference_docs' bucket");
  assert(getStorageBucket("schemes") === "reference_docs", "Maps schemes category to 'reference_docs' bucket");

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

  // 18. Database Service In Production (No Silent Fallback)
  console.log("\n--- 18. Production Database Guard (No Silent Fallback) ---");
  const { getStore, DatabaseServiceError } = await import("../src/lib/db/get-store");

  (process.env as any).NODE_ENV = "production";
  let prodStoreThrew = false;
  try {
    // Calling getStore in production without live Supabase credentials must throw DatabaseServiceError
    // Temporarily unset Supabase URL to test missing configuration
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      await getStore();
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    }
  } catch (err: any) {
    if (err instanceof DatabaseServiceError) {
      prodStoreThrew = true;
    }
  }
  (process.env as any).NODE_ENV = origNodeEnv;

  assert(prodStoreThrew, "getStore throws DatabaseServiceError in production when Supabase is missing (no silent fallback)");

  // 19. UUID Normalization for Remote PostgreSQL Schema Compatibility
  console.log("\n--- 19. PostgreSQL UUID Normalization ---");
  const { normalizeUuid } = await import("../src/lib/db/supabase-store");
  const testStandardUuid = "12345678-1234-4234-8234-123456789abc";
  assert(normalizeUuid(testStandardUuid) === testStandardUuid, "Preserves valid RFC4122 UUID unchanged");

  const convertedUuid = normalizeUuid("usr-teacher-001");
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(convertedUuid), "Converts synthetic teacher ID to valid RFC4122 UUID");
  assert(normalizeUuid("usr-teacher-001") === convertedUuid, "Deterministic UUID conversion is reproducible");

  // 20. Document Viewer State, Navigation, Rotation & Zoom
  console.log("\n--- 20. Document Viewer State, Navigation & Rotation ---");
  const {
    clampPage,
    nextPage,
    prevPage,
    goToPage,
    zoomIn,
    zoomOut,
    setZoom,
    rotateClockwise,
    rotateCounterClockwise,
    detectDocumentType,
    resetViewerState,
  } = await import("../src/lib/document/viewer-state");

  const initialState = resetViewerState(5);
  assert(initialState.currentPage === 1, "Initial page is 1");
  assert(initialState.totalPages === 5, "Total pages recognized as 5");
  assert(initialState.zoomLevel === 100, "Initial zoom is 100%");
  assert(initialState.rotation === 0, "Initial rotation is 0 degrees");

  // Page navigation clamping
  const p2 = nextPage(initialState);
  assert(p2.currentPage === 2, "nextPage advances from 1 to 2");
  const p1 = prevPage(p2);
  assert(p1.currentPage === 1, "prevPage retreats from 2 to 1");
  const p1Clamp = prevPage(p1);
  assert(p1Clamp.currentPage === 1, "prevPage clamps at page 1");
  const p5 = goToPage(5, initialState);
  assert(p5.currentPage === 5, "goToPage navigates directly to page 5");
  const pOverflow = goToPage(99, initialState);
  assert(pOverflow.currentPage === 5, "goToPage clamps at totalPages (5)");
  const pUnderflow = goToPage(-5, initialState);
  assert(pUnderflow.currentPage === 1, "goToPage clamps below 1 to page 1");

  // Zoom controls & clamping
  const zPlus = zoomIn(initialState);
  assert(zPlus.zoomLevel === 115, "zoomIn increases zoom by 15%");
  const zMinus = zoomOut(initialState);
  assert(zMinus.zoomLevel === 85, "zoomOut decreases zoom by 15%");
  const zMax = setZoom(999, initialState);
  assert(zMax.zoomLevel === 250, "setZoom clamps to MAX_ZOOM (250%)");
  const zMin = setZoom(10, initialState);
  assert(zMin.zoomLevel === 50, "setZoom clamps to MIN_ZOOM (50%)");

  // 90-degree Rotation
  const r90 = rotateClockwise(initialState);
  assert(r90.rotation === 90, "rotateClockwise turns 0 -> 90 degrees");
  const r180 = rotateClockwise(r90);
  assert(r180.rotation === 180, "rotateClockwise turns 90 -> 180 degrees");
  const r270 = rotateClockwise(r180);
  assert(r270.rotation === 270, "rotateClockwise turns 180 -> 270 degrees");
  const r360 = rotateClockwise(r270);
  assert(r360.rotation === 0, "rotateClockwise wraps 270 -> 0 degrees");
  const rCCW = rotateCounterClockwise(initialState);
  assert(rCCW.rotation === 270, "rotateCounterClockwise wraps 0 -> 270 degrees");

  // Document Type Detection
  assert(detectDocumentType("application/pdf", "test.pdf") === "pdf", "Detects PDF by mime and filename");
  assert(detectDocumentType(undefined, "student-submission.PDF") === "pdf", "Detects uppercase .PDF filename");
  assert(detectDocumentType("image/jpeg", "scan.jpg") === "image", "Detects JPEG image");
  assert(detectDocumentType("image/png", "scan.png") === "image", "Detects PNG image");
  assert(detectDocumentType("image/webp", "scan.webp") === "image", "Detects WebP image");
  assert(detectDocumentType("application/zip", "archive.zip") === "unsupported", "Identifies unsupported file formats");

  // 21. Assessment Creation Workflow & Document Role Verification
  console.log("\n--- 21. Assessment Creation Workflow & Document Roles ---");
  const { serverStore: testStore } = await import("../src/lib/db/server-store");
  const testAssessmentId = `asm-test-draft-${Date.now()}`;

  // Test creating draft assessment without questions
  const draftAsm = testStore.createAssessment({
    id: testAssessmentId,
    title: "Draft Exam Biology",
    subject: "Biology",
    grade_level: "Grade 10",
    section: "A",
    max_marks: 50,
    status: "draft",
    date: "2026-10-15",
    question_paper_name: "Original_Exam_Paper.pdf",
    question_paper_path: "reference_docs/papers/Original_Exam_Paper.pdf",
    marking_scheme_name: "Original_Marking_Scheme.pdf",
    marking_scheme_path: "reference_docs/schemes/Original_Marking_Scheme.pdf",
    questions: [],
  });
  assert(draftAsm.id === testAssessmentId, "Draft assessment created with custom ID");
  assert(draftAsm.status === "draft", "Assessment saved as draft status");
  assert(draftAsm.question_paper_name === "Original_Exam_Paper.pdf", "Question paper preserved as reference doc");
  assert(draftAsm.marking_scheme_name === "Original_Marking_Scheme.pdf", "Marking scheme preserved as reference doc");
  assert(draftAsm.marking_scheme_name !== draftAsm.question_paper_name, "Marking scheme and question paper are separate files");

  // Verify updating existing draft without duplicate key error
  const updatedDraft = testStore.updateAssessment(testAssessmentId, {
    title: "Finalized Exam Biology",
    status: "ready",
    max_marks: 60,
  });
  assert(updatedDraft?.title === "Finalized Exam Biology", "Draft updated successfully without collision");
  assert(updatedDraft?.max_marks === 60, "Updated max marks reflected");

  // Verify questions are optional: reading questions returns empty array
  const questionsList = testStore.getQuestions(testAssessmentId);
  assert(questionsList.length === 0, "Assessments without manual questions are valid and return empty questions list");

  // Verify scripts are optional at creation: scripts list returns empty array
  const scriptsList = testStore.getScripts(testAssessmentId);
  assert(scriptsList.length === 0, "Assessments without uploaded student scripts are valid and return empty scripts list");

  // Verify student script is strictly distinct from marking scheme
  const attachedScript = testStore.addScript({
    assessment_id: testAssessmentId,
    teacher_id: "usr-teacher-001",
    student_id: "stu-001",
    student_name: "Sarah Jenkins",
    roll_number: "BIO-001",
    file_name: "sarah_jenkins_answer_script.pdf",
    file_path: "scripts/sarah_jenkins_answer_script.pdf",
    file_size: 2048,
    mime_type: "application/pdf",
    page_count: 3,
    status: "uploaded",
    total_score: null,
    max_score: 60,
    percentage: null,
  });
  assert(attachedScript.file_name !== updatedDraft?.marking_scheme_name, "Student answer script is strictly distinct from marking scheme");
  assert(attachedScript.student_id === "stu-001", "Script correctly associated with candidate");

  // Verify whole-script score approval without questions
  testStore.approveAllResultsForScript(attachedScript.id, "Dr. Vance", "usr-teacher-001", 54);
  const updatedScript = testStore.getScript(attachedScript.id);
  assert(updatedScript?.status === "approved", "Script approved directly without per-question checkpoints");
  assert(updatedScript?.total_score === 54, "Script total score recorded as 54 marks");
  assert(updatedScript?.percentage === 90, "Script percentage calculated as 90% (54/60)");

  // 22. Cambridge 0580 Understanding-Map Foundation Tests
  console.log("\n--- 22. Cambridge 0580 Understanding Map Foundation ---");

  // Cambridge 0580 Mark Rules
  const validCambridgeCriteria = [
    { id: "c-1", mark_type: "M" as const, marks: 1, description: "Method for expanding brackets" },
    { id: "c-2", mark_type: "A" as const, marks: 1, description: "Accuracy for correct expansion", dependent_on: "c-1" },
    { id: "c-3", mark_type: "B" as const, marks: 1, description: "Independent mark for final answer" },
  ];
  const cambridgeRulesCheck = checkCambridgeMarkRules(validCambridgeCriteria);
  assert(cambridgeRulesCheck.valid, "Valid Cambridge M1, A1, B1 criteria chain passes validation");

  const invalidCambridgeCriteria = [
    { id: "c-err", mark_type: "A" as const, marks: 1, description: "Orphan accuracy mark without method" },
  ];
  const invalidRulesCheck = checkCambridgeMarkRules(invalidCambridgeCriteria);
  assert(!invalidRulesCheck.valid && invalidRulesCheck.warnings.length > 0, "Cambridge A mark without preceding M mark is rejected");

  // Hierarchical question tree and leaf extraction
  const hierarchicalQuestions: UnderstandingMapQuestionNode[] = [
    {
      id: "node-q1",
      question_number: 1,
      full_label: "1",
      title: "Algebraic Simplification",
      max_marks: 4,
      marking_criteria: [],
      question_paper_ref: { document_type: "question_paper", page: 2 },
      marking_scheme_ref: { document_type: "marking_scheme", page: 1 },
      sub_questions: [
        {
          id: "node-q1a",
          question_number: 1,
          sub_label: "(a)",
          full_label: "1(a)",
          max_marks: 1,
          question_paper_ref: {
            document_type: "question_paper",
            page: 2,
            bbox: { x: 0.1, y: 0.15, width: 0.8, height: 0.1 },
          },
          marking_scheme_ref: {
            document_type: "marking_scheme",
            page: 1,
            bbox: { x: 0.1, y: 0.2, width: 0.8, height: 0.08 },
          },
          marking_criteria: [
            { id: "c-1a", mark_type: "B", marks: 1, description: "Correct simplified term" },
          ],
        },
        {
          id: "node-q1b",
          question_number: 1,
          sub_label: "(b)",
          full_label: "1(b)",
          max_marks: 3,
          marking_criteria: [],
          question_paper_ref: { document_type: "question_paper", page: 2 },
          marking_scheme_ref: { document_type: "marking_scheme", page: 1 },
          sub_questions: [
            {
              id: "node-q1bi",
              question_number: 1,
              sub_label: "(b)(i)",
              full_label: "1(b)(i)",
              max_marks: 2,
              question_paper_ref: {
                document_type: "question_paper",
                page: 2,
                bbox: { x: 0.1, y: 0.28, width: 0.8, height: 0.15 },
              },
              marking_scheme_ref: {
                document_type: "marking_scheme",
                page: 1,
                bbox: { x: 0.1, y: 0.3, width: 0.8, height: 0.12 },
              },
              marking_criteria: [
                { id: "c-1bi-m", mark_type: "M", marks: 1, description: "Method for factorizing" },
                { id: "c-1bi-a", mark_type: "A", marks: 1, description: "Correct factors", dependent_on: "c-1bi-m" },
              ],
            },
            {
              id: "node-q1bii",
              question_number: 1,
              sub_label: "(b)(ii)",
              full_label: "1(b)(ii)",
              max_marks: 1,
              question_paper_ref: {
                document_type: "question_paper",
                page: 2,
                bbox: { x: 0.1, y: 0.45, width: 0.8, height: 0.1 },
              },
              marking_scheme_ref: {
                document_type: "marking_scheme",
                page: 1,
                bbox: { x: 0.1, y: 0.44, width: 0.8, height: 0.08 },
              },
              marking_criteria: [
                { id: "c-1bii", mark_type: "B", marks: 1, description: "Follow-through solution", is_follow_through: true },
              ],
            },
          ],
        },
      ],
    },
  ];

  const leafNodes = flattenLeafQuestionNodes(hierarchicalQuestions);
  assert(leafNodes.length === 3, "Leaf flattening correctly extracts 3 gradable sub-questions (1(a), 1(b)(i), 1(b)(ii))");
  assert(leafNodes.map(n => n.full_label).join(",") === "1(a),1(b)(i),1(b)(ii)", "Leaf nodes preserve exact Cambridge question numbering hierarchy");

  const computedTotal = calculateMapTotalMarks(hierarchicalQuestions);
  assert(computedTotal === 4, "Calculated map total marks matches sum of leaf nodes (1 + 2 + 1 = 4)");

  // Normalized Bounding Box Validation
  const validMapObject: AssessmentUnderstandingMap = {
    id: "map-test-0580",
    assessment_id: testAssessmentId,
    syllabus_code: "0580",
    paper_code: "Paper 4",
    total_max_marks: 4,
    total_questions_count: 3,
    unresolved_items_count: 0,
    has_ambiguities: false,
    status: "proposed",
    version: 1,
    source_question_paper: {
      path: "reference_docs/papers/Original_Exam_Paper.pdf",
      name: "Original_Exam_Paper.pdf",
      fingerprint: computeSourceFingerprint("reference_docs/papers/Original_Exam_Paper.pdf", "Original_Exam_Paper.pdf", 102400),
    },
    source_marking_scheme: {
      path: "reference_docs/schemes/Original_Marking_Scheme.pdf",
      name: "Original_Marking_Scheme.pdf",
      fingerprint: computeSourceFingerprint("reference_docs/schemes/Original_Marking_Scheme.pdf", "Original_Marking_Scheme.pdf", 51200),
    },
    nodes: hierarchicalQuestions,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mapValidation = validateUnderstandingMap(validMapObject);
  assert(mapValidation.valid, "Valid Cambridge 0580 understanding map schema and coordinate bounds pass validation");

  const invalidCoordsMap: AssessmentUnderstandingMap = {
    ...validMapObject,
    id: "map-invalid-coords",
    nodes: [
      {
        id: "bad-q",
        question_number: 1,
        full_label: "1",
        max_marks: 1,
        marking_criteria: [],
        question_paper_ref: {
          document_type: "question_paper",
          page: 1,
          bbox: { x: 1.5, y: -0.2, width: 0.5, height: 0.5 }, // invalid: x > 1, y < 0
        },
        marking_scheme_ref: { document_type: "marking_scheme", page: 1 },
      },
    ],
  };
  const invalidValidation = validateUnderstandingMap(invalidCoordsMap);
  assert(!invalidValidation.valid && invalidValidation.errors.some(e => e.includes("bounding box")), "Out-of-bounds coordinates (> 1.0 or < 0.0) correctly rejected");

  // Source Document Freshness & Invalidation
  const currentQp = {
    path: "reference_docs/papers/Original_Exam_Paper.pdf",
    name: "Original_Exam_Paper.pdf",
    fingerprint: computeSourceFingerprint("reference_docs/papers/Original_Exam_Paper.pdf", "Original_Exam_Paper.pdf", 102400),
  };
  const currentMs = {
    path: "reference_docs/schemes/Original_Marking_Scheme.pdf",
    name: "Original_Marking_Scheme.pdf",
    fingerprint: computeSourceFingerprint("reference_docs/schemes/Original_Marking_Scheme.pdf", "Original_Marking_Scheme.pdf", 51200),
  };

  const freshEvaluation = evaluateMapFreshness(validMapObject, currentQp, currentMs);
  assert(!freshEvaluation.isStale, "Map is fresh when current question paper and marking scheme match original fingerprints");

  const alteredQp = {
    path: "reference_docs/papers/Original_Exam_Paper_revised.pdf",
    name: "Original_Exam_Paper_v2.pdf",
    fingerprint: computeSourceFingerprint("reference_docs/papers/Original_Exam_Paper_revised.pdf", "Original_Exam_Paper_v2.pdf", 102400),
  };
  const staleEvaluation = evaluateMapFreshness(validMapObject, alteredQp, currentMs);
  assert(Boolean(staleEvaluation.isStale && staleEvaluation.staleReason?.includes("Question paper")), "Map immediately invalidated as stale when Question Paper changes");

  // Storage Persistence and Cohort Reuse
  testStore.saveUnderstandingMap(validMapObject);
  const retrievedMap = testStore.getUnderstandingMap(testAssessmentId);
  assert(retrievedMap !== null, "Understanding map persisted and retrieved from store");
  assert(retrievedMap?.status === "proposed", "Retrieved map begins in proposed status");

  // Verify and lock understanding map
  testStore.verifyUnderstandingMap(testAssessmentId, "Dr. Vance", "usr-teacher-001");
  const verifiedMap = testStore.getUnderstandingMap(testAssessmentId);
  assert(verifiedMap?.status === "verified", "Understanding map status upgraded to verified");
  assert(verifiedMap?.verified_by === "Dr. Vance", "Verified map records teacher name");
  assert(Boolean(verifiedMap?.verified_at), "Verified map records cryptographic timestamp");

  // Confirm reuse across multiple student scripts
  const script1Map = testStore.getUnderstandingMap(testAssessmentId);
  const script2Map = testStore.getUnderstandingMap(testAssessmentId);
  assert(script1Map?.id === script2Map?.id, "Identical understanding map reused across multiple student submissions");
  assert(script1Map?.total_questions_count === 3, "Reused map provides consistent Cambridge 0580 question structure to all scripts");

  console.log(`\n==================================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
