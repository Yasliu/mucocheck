import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }

    return NextResponse.json({
      success: true,
      message: "Successfully signed out.",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Sign out error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
