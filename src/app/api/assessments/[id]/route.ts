import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const { id } = await params;
    const assessment = serverStore.getAssessment(id);

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.teacher_id && assessment.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to view another teacher's assessment."
      );
    }

    const questions = serverStore.getQuestions(id);
    const scripts = serverStore.getScripts(id);
    const results = serverStore.getGradingResults(id);

    return NextResponse.json({
      success: true,
      assessment,
      questions,
      scripts,
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error fetching assessment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const { id } = await params;
    const assessment = serverStore.getAssessment(id);

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.teacher_id && assessment.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to modify another teacher's assessment."
      );
    }

    const updates = await req.json();
    const updated = serverStore.updateAssessment(id, updates);
    return NextResponse.json({ success: true, assessment: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update assessment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const { id } = await params;
    const assessment = serverStore.getAssessment(id);

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.teacher_id && assessment.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to delete another teacher's assessment."
      );
    }

    serverStore.deleteAssessment(id);
    return NextResponse.json({ success: true, message: "Assessment deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete assessment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
