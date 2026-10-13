import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";
import { generateReportCardPdf } from "@/lib/reports/pdf-generator";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const { studentId } = await params;
    const stu = serverStore.getStudent(studentId);
    if (!stu) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (stu.teacher_id && stu.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to download report card PDFs for another teacher's student."
      );
    }

    const report = serverStore.getStudentReportCard(studentId);

    const pdfBuffer = generateReportCardPdf(report);
    const filename = `${report.student.full_name.replace(/[^a-zA-Z0-9_-]/g, "_")}_ReportCard.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "PDF generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
