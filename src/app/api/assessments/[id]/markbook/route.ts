import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const targetScaleParam = searchParams.get("targetScaleMax");
    const targetScaleMax = targetScaleParam ? Number(targetScaleParam) : undefined;

    const markbook = serverStore.getMarkbook(id, targetScaleMax);
    return NextResponse.json({ success: true, markbook });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate markbook";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
