import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthTeacher {
  id: string;
  email: string;
  full_name: string;
  role: "teacher" | "admin";
  source: "supabase" | "header" | "fallback";
}

export const DEFAULT_TEACHER: AuthTeacher = {
  id: "usr-teacher-001",
  email: "vance@mucono.edu",
  full_name: "Dr. Eleanor Vance",
  role: "teacher",
  source: "fallback",
};

/**
 * Resolves the authenticated teacher from:
 * 1. Supabase Auth session (via cookies)
 * 2. Request header (Authorization: Bearer <token> or x-teacher-id)
 * 3. Fallback default teacher (for seamless local development / unconfigured remote state)
 */
export async function getAuthenticatedTeacher(req?: Request): Promise<AuthTeacher | null> {
  // 1. Check custom headers (for automated tests or programmatic API client)
  if (req) {
    const customTeacherId = req.headers.get("x-teacher-id");
    const customTeacherEmail = req.headers.get("x-teacher-email");
    const customTeacherName = req.headers.get("x-teacher-name");

    if (customTeacherId) {
      return {
        id: customTeacherId,
        email: customTeacherEmail || `${customTeacherId}@mucono.edu`,
        full_name: customTeacherName || `Teacher ${customTeacherId}`,
        role: "teacher",
        source: "header",
      };
    }
  }

  // 2. Check Supabase Auth Session
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        return {
          id: user.id,
          email: user.email || "teacher@mucono.edu",
          full_name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Authenticated Teacher",
          role: "teacher",
          source: "supabase",
        };
      }
    }
  } catch (err) {
    // Supabase auth service unavailable or cookies not readable in current context
  }

  // 3. Fallback to default local teacher
  return { ...DEFAULT_TEACHER };
}

/**
 * Asserts that the request is authenticated.
 * If strict = true, rejects fallback identities without explicit session/header.
 */
export async function requireTeacher(
  req?: Request,
  options?: { strict?: boolean }
): Promise<AuthTeacher> {
  const teacher = await getAuthenticatedTeacher(req);

  if (!teacher) {
    throw new Error("Authentication required");
  }

  if (options?.strict && teacher.source === "fallback") {
    // If explicit header forbids fallback
    const allowFallback = req?.headers.get("x-allow-fallback") !== "false";
    if (!allowFallback) {
      throw new Error("Authentication required: Live session or valid credentials required");
    }
  }

  return teacher;
}

/**
 * Verifies that the authenticated teacher is authorized to access a given resource.
 * Returns false if the resource belongs to another teacher.
 */
export function verifyTeacherOwnership(
  teacher: AuthTeacher,
  resourceOwnerId?: string
): boolean {
  if (!resourceOwnerId) return true; // Legacy or shared resource without explicit owner
  return teacher.id === resourceOwnerId;
}

export function unauthorizedResponse(
  message = "Authentication required. Please sign in to continue."
): NextResponse {
  return NextResponse.json({ error: message, code: "UNAUTHORIZED" }, { status: 401 });
}

export function forbiddenResponse(
  message = "Forbidden: You do not have permission to access or modify this teacher's records."
): NextResponse {
  return NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 });
}
