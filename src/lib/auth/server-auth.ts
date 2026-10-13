import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthTeacher {
  id: string;
  email: string;
  full_name: string;
  role: "teacher" | "admin";
  source: "supabase" | "dev_mode" | "fallback";
}

export const DEFAULT_TEACHER: AuthTeacher = {
  id: "usr-teacher-001",
  email: "vance@mucono.edu",
  full_name: "Dr. Eleanor Vance",
  role: "teacher",
  source: "fallback",
};

/**
 * Checks whether development authentication bypass is explicitly permitted.
 * CRITICAL SECURITY GUARANTEE:
 * Returns false unconditionally whenever NODE_ENV === 'production'.
 * It is impossible to activate dev bypass in production.
 */
export function isDevAuthAllowed(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return (
    process.env.MUCO_DEV_AUTH_BYPASS === "true" ||
    process.env.NEXT_PUBLIC_DEV_MODE === "true" ||
    process.env.NODE_ENV === "test"
  );
}

/**
 * Resolves the authenticated teacher identity:
 * 1. Checks Supabase Auth session via cookies or Authorization: Bearer JWT.
 * 2. In production: REJECTS immediately if no valid Supabase session exists.
 *    Never trusts caller-supplied identity headers (e.g. x-teacher-id).
 * 3. In non-production ONLY: If dev bypass is explicitly active (isDevAuthAllowed() === true),
 *    permits controlled synthetic identities for test automation or local offline work.
 */
export async function getAuthenticatedTeacher(req?: Request): Promise<AuthTeacher | null> {
  // 1. Authenticate against Supabase Auth (Primary and only production mechanism)
  try {
    const supabase = await createServerSupabaseClient(req);
    if (supabase) {
      const authHeader = req?.headers.get("authorization");
      const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

      const {
        data: { user },
        error,
      } = jwt ? await supabase.auth.getUser(jwt) : await supabase.auth.getUser();

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
  } catch {
    // Supabase client failure or network error
  }

  // 2. Strict Production Guard: If in production, NO fallback or caller headers are accepted.
  if (process.env.NODE_ENV === "production" || !isDevAuthAllowed()) {
    return null;
  }

  // 3. Development / Test Only Mode
  // Note: Only accessible when NODE_ENV !== 'production' AND isDevAuthAllowed() is true.
  if (req) {
    // In dev/test mode, synthetic teacher can be passed via explicit test header x-dev-test-teacher-id
    const devTestTeacherId = req.headers.get("x-dev-test-teacher-id");
    if (devTestTeacherId) {
      return {
        id: devTestTeacherId,
        email: req.headers.get("x-dev-test-teacher-email") || `${devTestTeacherId}@mucono.edu`,
        full_name: req.headers.get("x-dev-test-teacher-name") || `Dev Teacher ${devTestTeacherId}`,
        role: "teacher",
        source: "dev_mode",
      };
    }
  }

  // Local development default teacher (active ONLY when dev bypass is explicitly allowed)
  return { ...DEFAULT_TEACHER };
}

/**
 * Asserts that the request is authenticated.
 * Throws an Error with code "UNAUTHORIZED" if authentication fails.
 */
export async function requireTeacher(req?: Request): Promise<AuthTeacher> {
  const teacher = await getAuthenticatedTeacher(req);

  if (!teacher) {
    throw new Error("UNAUTHORIZED");
  }

  if (process.env.NODE_ENV === "production" && teacher.source !== "supabase") {
    throw new Error("UNAUTHORIZED");
  }

  return teacher;
}

/**
 * Verifies that the authenticated teacher owns the target resource.
 * Returns true if teacher is the verified owner, false otherwise.
 */
export function verifyTeacherOwnership(
  teacher: AuthTeacher,
  resourceOwnerId?: string | null
): boolean {
  if (!resourceOwnerId) return false;
  return teacher.id === resourceOwnerId;
}

export function unauthorizedResponse(
  message = "Authentication required. Please sign in to continue."
): NextResponse {
  return NextResponse.json(
    { error: message, code: "UNAUTHORIZED" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Bearer error="invalid_token"',
      },
    }
  );
}

export function forbiddenResponse(
  message = "Forbidden: You do not have permission to access or modify this teacher's records."
): NextResponse {
  return NextResponse.json(
    { error: message, code: "FORBIDDEN" },
    { status: 403 }
  );
}
