import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/get-store";
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
    const store = await getStore(req);
    const assessment = await store.getAssessment(id);
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.teacher_id && assessment.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to attach scripts to another teacher's assessment."
      );
    }

    const body = await req.json();

    const script = await (store as any).addScript({
      assessment_id: id,
      teacher_id: teacher.id,
      student_id: body.student_id,
      student_name: body.student_name,
      roll_number: body.roll_number,
      file_name: body.file_name,
      file_path: body.file_path,
      file_size: Number(body.file_size) || 1024,
      mime_type: body.mime_type || "application/pdf",
      page_count: Number(body.page_count) || 1,
      status: "uploaded",
      total_score: null,
      max_score: assessment.max_marks,
      percentage: null,
    });

    return NextResponse.json({ success: true, script });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to add script";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
