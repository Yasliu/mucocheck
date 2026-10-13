import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/get-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function GET(req: Request) {
  const teacher = await getAuthenticatedTeacher(req);
  if (!teacher) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const assessmentId = searchParams.get("assessmentId");

  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId parameter is required" }, { status: 400 });
  }

  try {
    const store = await getStore(req);
    const assessment = await store.getAssessment(assessmentId);
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.teacher_id && assessment.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to export another teacher's assessment."
      );
    }

    const markbook = await (store as any).getMarkbook(assessmentId, teacher.id);
    const { questions, rows } = markbook;

    // Build CSV Headers
    const headers = [
      "Roll Number",
      "Student Name",
      ...questions.map((q: any) => `Q${q.question_number} (Max ${q.max_marks})`),
      `Raw Total (Max ${assessment.max_marks})`,
      "Percentage",
      "Status",
    ];

    const csvLines = [headers.join(",")];

    for (const r of rows) {
      const qScores = questions.map((q: any) => {
        const val = r.question_scores[q.id];
        if (!val) return "—";
        const score = val.approved_score !== null ? val.approved_score : val.proposed_score;
        return score !== null ? score.toString() : "—";
      });

      const line = [
        `"${r.student.roll_number}"`,
        `"${r.student.full_name}"`,
        ...qScores,
        r.raw_total !== null ? r.raw_total.toString() : "—",
        r.percentage !== null ? `${r.percentage}%` : "—",
        `"${r.approval_status}"`,
      ];

      csvLines.push(line.join(","));
    }

    const csvContent = csvLines.join("\r\n");
    const filename = `${assessment.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Markbook.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "CSV generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
