import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/get-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function GET(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const store = await getStore(req);
    const classes = await store.getClasses(teacher.id);
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

    const store = await getStore(req);

    if (body.id) {
      const existing = await store.getClass(body.id);
      if (existing && existing.teacher_id && existing.teacher_id !== teacher.id) {
        return forbiddenResponse(
          "Access denied: You do not have permission to modify another teacher's class."
        );
      }

      const updated = await (store as any).updateClass(body.id, teacher.id, {
        name: body.name,
        grade_level: body.grade_level || "Grade 10",
        section: body.section || "A",
        academic_year: body.academic_year || "2026-2027",
      });
      return NextResponse.json({ success: true, class: updated });
    }

    const created = await (store as any).createClass(teacher.id, {
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
