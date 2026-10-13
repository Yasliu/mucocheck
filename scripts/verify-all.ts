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

  console.log(`\n==================================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
