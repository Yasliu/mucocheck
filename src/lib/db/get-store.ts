import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseStore } from "./supabase-store";
import { serverStore } from "./server-store";
import { isDevAuthAllowed } from "../auth/server-auth";

export class DatabaseServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseServiceError";
  }
}

/**
 * Returns the active data access store for the current request.
 * In production:
 * - Demands a live Supabase client.
 * - Strictly throws DatabaseServiceError if Supabase is unavailable.
 * - NEVER falls back to local JSON (.data/db.json).
 *
 * In development / testing:
 * - Uses SupabaseStore if Supabase client is available.
 * - Uses local serverStore ONLY if isDevAuthAllowed() is true.
 */
export async function getStore(req?: Request): Promise<SupabaseStore | typeof serverStore> {
  const isProd = process.env.NODE_ENV === "production";

  let supabase = null;
  try {
    supabase = await createServerSupabaseClient(req);
  } catch (err: any) {
    if (isProd) {
      throw new DatabaseServiceError(
        `Production database client initialization failed: ${err.message}`
      );
    }
  }

  if (supabase) {
    return new SupabaseStore(supabase);
  }

  if (isProd || !isDevAuthAllowed()) {
    throw new DatabaseServiceError(
      "Database unavailable: Live Supabase configuration is required in production."
    );
  }

  // Development/Test fallback only when explicitly permitted
  return serverStore;
}
