import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function GET(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") || undefined;
    const students = serverStore.getStudents(classId, teacher.id);
    return NextResponse.json({ success: true, students });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch students";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const body = await req.json();

    if (!body.full_name || !body.roll_number || !body.class_id) {
      return NextResponse.json(
        { error: "full_name, roll_number, and class_id are required" },
        { status: 400 }
      );
    }

    if (body.id) {
      const existing = serverStore.getStudent(body.id);
      if (existing && existing.teacher_id && existing.teacher_id !== teacher.id) {
        return forbiddenResponse(
          "Access denied: You do not have permission to modify another teacher's student."
        );
      }

      const updated = serverStore.updateStudent(body.id, {
        full_name: body.full_name,
        roll_number: body.roll_number,
        email: body.email,
        class_id: body.class_id,
      });
      return NextResponse.json({ success: true, student: updated });
    }

    const created = serverStore.createStudent({
      teacher_id: teacher.id,
      full_name: body.full_name,
      roll_number: body.roll_number,
      class_id: body.class_id,
      email: body.email,
    });

    return NextResponse.json({ success: true, student: created });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save student";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
