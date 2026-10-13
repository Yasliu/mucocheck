import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/get-store";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";

export async function POST(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const body = await req.json();
    const { action, resultId, scriptId, reason, newQuestionId, finalScore, teacherName } = body;
    const effectiveTeacherName = teacherName || teacher.full_name;

    const store = await getStore(req);

    if (action === "approve_script") {
      if (!scriptId) {
        return NextResponse.json({ error: "scriptId is required for approve_script" }, { status: 400 });
      }

      const scr = await (store as any).getScript(scriptId);
      if (!scr) {
        return NextResponse.json({ error: "Script not found" }, { status: 404 });
      }

      const asm = await store.getAssessment(scr.assessment_id);
      if (asm && asm.teacher_id && asm.teacher_id !== teacher.id) {
        return forbiddenResponse(
          "Access denied: You do not have permission to approve scripts for another teacher's assessment."
        );
      }

      await (store as any).approveAllResultsForScript(scriptId, effectiveTeacherName, teacher.id);
      return NextResponse.json({ success: true, message: "Script results approved." });
    }

    if (!resultId) {
      return NextResponse.json({ error: "resultId is required." }, { status: 400 });
    }

    const target = await (store as any).getGradingResult(resultId);
    if (!target) {
      return NextResponse.json({ error: "Grading result not found" }, { status: 404 });
    }

    const asm = await store.getAssessment(target.assessment_id);
    if (asm && asm.teacher_id && asm.teacher_id !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to perform review actions on another teacher's assessment."
      );
    }

    let updated;
    switch (action) {
      case "flag_unreadable":
        updated = await (store as any).flagUnreadable(resultId, reason || "Handwriting illegible or smudged", effectiveTeacherName, teacher.id);
        break;
      case "correct_match":
        if (!newQuestionId) {
          return NextResponse.json({ error: "newQuestionId required for match correction" }, { status: 400 });
        }
        updated = await (store as any).correctMatch(resultId, newQuestionId, reason || "Teacher corrected question match", effectiveTeacherName, teacher.id);
        break;
      case "reject_proposal":
        updated = await (store as any).rejectProposal(resultId, reason || "Teacher rejected proposed evaluation", effectiveTeacherName, teacher.id);
        break;
      case "approve":
        updated = await (store as any).approveGradingResult(resultId, finalScore, reason, effectiveTeacherName, teacher.id);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Action failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
