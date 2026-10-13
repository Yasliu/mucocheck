import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const { id } = await params;
    const target = serverStore.getGradingResult(id);
    if (!target) {
      return NextResponse.json({ error: "Grading result not found" }, { status: 404 });
    }

    const asm = serverStore.getAssessment(target.assessment_id);
    if (asm && asm.teacher_id && asm.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to modify grading results for another teacher's assessment."
      );
    }

    const body = await req.json();

    const updated = serverStore.updateGradingResult(id, {
      approved_score: body.approved_score !== undefined ? (body.approved_score === null ? null : Number(body.approved_score)) : undefined,
      feedback: body.feedback,
      status: body.status,
      edited_by_teacher: body.edited_by_teacher !== undefined ? body.edited_by_teacher : true,
      reason: body.reason,
      teacher_name: body.teacher_name || teacher.full_name,
      is_unreadable: body.is_unreadable,
      unreadable_reason: body.unreadable_reason,
      question_id: body.question_id,
    });

    return NextResponse.json({ success: true, result: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update grading result";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
