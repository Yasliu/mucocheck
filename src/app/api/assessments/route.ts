import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
} from "@/lib/auth/server-auth";

export async function GET(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) {
      return unauthorizedResponse();
    }

    if (req.headers.get("x-allow-fallback") === "false" && teacher.source === "fallback") {
      return unauthorizedResponse("Authentication required: Live credentials required.");
    }

    const assessments = serverStore.getAssessments(teacher.id);
    return NextResponse.json({ success: true, assessments });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch assessments";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) {
      return unauthorizedResponse();
    }

    if (req.headers.get("x-allow-fallback") === "false" && teacher.source === "fallback") {
      return unauthorizedResponse("Authentication required: Live credentials required.");
    }

    const body = await req.json();

    if (!body.title || !body.subject) {
      return NextResponse.json(
        { error: "Assessment title and subject are required." },
        { status: 400 }
      );
    }

    const created = serverStore.createAssessment({
      id: body.id,
      teacher_id: teacher.id,
      title: body.title,
      subject: body.subject,
      grade_level: body.grade_level || "Grade 10",
      section: body.section || "A",
      class_id: body.class_id,
      max_marks: Number(body.max_marks) || 50,
      status: body.status || "draft",
      date: body.date || new Date().toISOString().split("T")[0],
      question_paper_name: body.question_paper_name,
      question_paper_path: body.question_paper_path,
      marking_scheme_name: body.marking_scheme_name,
      marking_scheme_path: body.marking_scheme_path,
      questions: body.questions || [],
    });

    return NextResponse.json({ success: true, assessment: created });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save assessment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
