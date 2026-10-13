import { NextResponse } from "next/server";
import { isDevAuthAllowed } from "@/lib/auth/server-auth";
import { repository } from "@/lib/db/repo";
import { serverStore } from "@/lib/db/server-store";

export async function POST() {
  // Strictly forbidden in production
  if (process.env.NODE_ENV === "production" || !isDevAuthAllowed()) {
    return NextResponse.json(
      { error: "Seed endpoint is disabled in production.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    serverStore.resetToDefaultSeed();
    repository.resetToDefaultSeed();
    return NextResponse.json({ success: true, message: "Seed data successfully restored in development mode." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
