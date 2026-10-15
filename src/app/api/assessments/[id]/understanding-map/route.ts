import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/get-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";
import {
  evaluateMapFreshness,
  validateUnderstandingMap,
} from "@/lib/understanding/validator";
import { AssessmentUnderstandingMap } from "@/lib/understanding/types";

export async function GET(
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
        "Access denied: You do not have permission to view this assessment's understanding map."
      );
    }

    const map = await (store as any).getUnderstandingMap(id);
    const freshness = evaluateMapFreshness(
      map,
      { path: assessment.question_paper_path, name: assessment.question_paper_name },
      { path: assessment.marking_scheme_path, name: assessment.marking_scheme_name }
    );

    return NextResponse.json({
      understanding_map: map,
      freshness,
      has_map: Boolean(map),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch understanding map";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
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
        "Access denied: You do not have permission to modify this assessment's understanding map."
      );
    }

    const body = await req.json();

    // Verify existing map action
    if (body.action === "verify") {
      const verified = await (store as any).verifyUnderstandingMap(
        id,
        teacher.id,
        body.teacher_notes
      );
      if (!verified) {
        return NextResponse.json(
          { error: "No understanding map exists to verify." },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        understanding_map: verified,
      });
    }

    // Save/update map
    const mapPayload: AssessmentUnderstandingMap = {
      ...body,
      assessment_id: id,
    };

    const validation = validateUnderstandingMap(mapPayload);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid understanding map structure", details: validation.errors },
        { status: 400 }
      );
    }

    const saved = await (store as any).saveUnderstandingMap(mapPayload);

    return NextResponse.json({
      success: true,
      understanding_map: saved,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save understanding map";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
