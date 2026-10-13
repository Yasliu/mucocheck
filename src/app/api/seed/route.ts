import { NextResponse } from "next/server";
import { repository } from "@/lib/db/repo";
import { serverStore } from "@/lib/db/server-store";

export async function POST() {
  try {
    serverStore.resetToDefaultSeed();
    repository.resetToDefaultSeed();
    return NextResponse.json({ success: true, message: "Seed data successfully restored." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
