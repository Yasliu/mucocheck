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

    const classes = serverStore.getClasses(teacher.id);
    return NextResponse.json({ success: true, classes });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch classes";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 });
    }

    if (body.id) {
      const existing = serverStore.getClass(body.id);
      if (existing && existing.teacher_id && existing.teacher_id !== teacher.id) {
        return forbiddenResponse(
          "Access denied: You do not have permission to modify another teacher's class."
        );
      }

      const updated = serverStore.updateClass(body.id, {
        name: body.name,
        grade_level: body.grade_level || "Grade 10",
        section: body.section || "A",
        academic_year: body.academic_year || "2026-2027",
      });
      return NextResponse.json({ success: true, class: updated });
    }

    const created = serverStore.createClass({
      teacher_id: teacher.id,
      name: body.name,
      grade_level: body.grade_level || "Grade 10",
      section: body.section || "A",
      academic_year: body.academic_year || "2026-2027",
    });

    return NextResponse.json({ success: true, class: created });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save class";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
