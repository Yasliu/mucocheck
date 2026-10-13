import { NextResponse } from "next/server";
import { gradingEngine } from "@/lib/grading/engine";
import { getStore } from "@/lib/db/get-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function POST(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const body = await req.json();
    const { assessmentId, scriptId, preferredMode } = body;

    if (!assessmentId || !scriptId) {
      return NextResponse.json(
        { error: "assessmentId and scriptId are required." },
        { status: 400 }
      );
    }

    const store = await getStore(req);

    // Verify assessment ownership
    const asm = await store.getAssessment(assessmentId);
    if (!asm) {
      return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    }
    if (asm.teacher_id && asm.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to trigger grading on another teacher's assessment."
      );
    }

    const script = await (store as any).getScript(scriptId);
    if (!script) {
      return NextResponse.json({ error: "Script not found." }, { status: 404 });
    }

    const questions = await store.getQuestions(assessmentId);
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
      studentAnswerText: `Candidate handwriting response extracted for Question ${q.question_number}`,
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

    // Save outputs through store
    for (const res of result.results) {
      await (store as any).saveGradingProposal(
        assessmentId,
        scriptId,
        res.questionId,
        script.student_id,
        {
          proposedMarks: res.proposedMarks,
          conciseRationale: res.conciseRationale,
          uncertaintyStatus: res.uncertaintyStatus,
          confidenceScore: res.confidenceScore,
          criteriaSatisfied: res.criteriaSatisfied,
          isMock: res.isMock,
          isUnreadable: res.isUnreadable,
          isUnmatched: res.isUnmatched,
        }
      );
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
