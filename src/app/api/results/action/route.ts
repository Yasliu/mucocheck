import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, resultId, scriptId, reason, newQuestionId, finalScore, teacherName } = body;

    if (action === "approve_script") {
      if (!scriptId) {
        return NextResponse.json({ error: "scriptId is required for approve_script" }, { status: 400 });
      }
      serverStore.approveAllResultsForScript(scriptId, teacherName);
      return NextResponse.json({ success: true, message: "Script results approved." });
    }

    if (!resultId) {
      return NextResponse.json({ error: "resultId is required." }, { status: 400 });
    }

    let updated;
    switch (action) {
      case "flag_unreadable":
        updated = serverStore.flagUnreadable(resultId, reason || "Handwriting illegible or smudged", teacherName);
        break;
      case "correct_match":
        if (!newQuestionId) {
          return NextResponse.json({ error: "newQuestionId required for match correction" }, { status: 400 });
        }
        updated = serverStore.correctMatch(resultId, newQuestionId, reason || "Teacher corrected question match", teacherName);
        break;
      case "reject_proposal":
        updated = serverStore.rejectProposal(resultId, reason || "Teacher rejected proposed evaluation", teacherName);
        break;
      case "approve":
        updated = serverStore.approveGradingResult(resultId, finalScore, reason, teacherName);
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
