import { NextResponse } from "next/server";
import { repository } from "@/lib/db/repo";

export async function POST() {
  try {
    repository.resetToDefaultSeed();
    return NextResponse.json({ success: true, message: "Seed data successfully restored." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
