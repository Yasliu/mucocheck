import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const report = serverStore.getStudentReportCard(studentId);
    return NextResponse.json({ success: true, report });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate report card";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
