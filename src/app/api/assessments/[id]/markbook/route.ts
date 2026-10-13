import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/get-store";
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
    const store = await getStore(req);
    const asm = await store.getAssessment(id);
    if (!asm) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (asm.teacher_id && asm.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to access markbooks for another teacher's assessment."
      );
    }

    const { searchParams } = new URL(req.url);
    const targetScaleParam = searchParams.get("targetScaleMax");
    const targetScaleMax = targetScaleParam ? Number(targetScaleParam) : undefined;

    const markbook = await (store as any).getMarkbook(id, teacher.id, targetScaleMax);
    return NextResponse.json({ success: true, markbook });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate markbook";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
