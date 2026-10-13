import { NextResponse } from "next/server";
import { gradingEngine } from "@/lib/grading/engine";
import { repository } from "@/lib/db/repo";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assessmentId, scriptId, preferredMode } = body;

    if (!assessmentId || !scriptId) {
      return NextResponse.json(
        { error: "assessmentId and scriptId are required." },
        { status: 400 }
      );
    }

    const script = repository.getScript(scriptId);
    if (!script) {
      return NextResponse.json({ error: "Script not found." }, { status: 404 });
    }

    const questions = repository.getQuestions(assessmentId);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No assessment questions configured." },
        { status: 400 }
      );
    }

    const gradingInputs = questions.map((q) => ({
      questionId: q.id,
      questionNumber: q.question_number,
      questionText: q.question_text,
      maxMarks: q.max_marks,
      rubricCriteria: q.rubric_criteria,
      modelAnswer: q.model_answer,
      studentAnswerText: `Extracted handwriting candidate text for Question ${q.question_number}`,
      scriptImageReference: script.file_path,
      scriptPageIndex: q.question_number,
      extractionConfidence: 0.92,
      studentId: script.student_id,
      studentName: script.student_name,
    }));

    const result = await gradingEngine.evaluateScript(
      {
        assessmentId,
        scriptId,
        studentId: script.student_id,
        studentName: script.student_name,
        filePath: script.file_path,
        questions: gradingInputs,
      },
      preferredMode || "mock"
    );

    // Save outputs to repository
    for (const res of result.results) {
      const existing = repository
        .getGradingResults(assessmentId, scriptId)
        .find((r) => r.question_id === res.questionId);

      if (existing) {
        repository.updateGradingResult(existing.id, {
          approved_score: null, // AI proposals remain unapproved until teacher approves
          status: res.uncertaintyStatus === "high_uncertainty" ? "needs_review" : "proposed",
          feedback: res.conciseRationale,
          edited_by_teacher: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      provider: result.providerName,
      isMock: result.isMock,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Grading failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
