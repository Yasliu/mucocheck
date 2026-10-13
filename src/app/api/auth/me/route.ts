import { NextResponse } from "next/server";
import { getAuthenticatedTeacher } from "@/lib/auth/server-auth";

export async function GET(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    return NextResponse.json({
      success: true,
      teacher,
      authenticated: Boolean(teacher),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Authentication error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
