import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const { studentId } = await params;
    const stu = serverStore.getStudent(studentId);
    if (!stu) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (stu.teacher_id && stu.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to access another teacher's student report."
      );
    }

    const report = serverStore.getStudentReportCard(studentId);
    return NextResponse.json({ success: true, report });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate report card";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
