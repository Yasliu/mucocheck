import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assessment = serverStore.getAssessment(id);

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
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
    const { id } = await params;
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
    const { id } = await params;
    serverStore.deleteAssessment(id);
    return NextResponse.json({ success: true, message: "Assessment deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete assessment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
