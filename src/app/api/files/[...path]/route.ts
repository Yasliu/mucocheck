import { NextResponse } from "next/server";
import { getPrivateFile } from "@/lib/storage/file-storage";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";
import { getStore } from "@/lib/db/get-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];
    let relativePath = pathSegments.join("/");

    if (!relativePath) {
      return NextResponse.json({ error: "Missing file path" }, { status: 400 });
    }

    // 1. Authenticate Teacher
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) {
      return unauthorizedResponse("Authentication required to access student scripts or schemes.");
    }

    const store = await getStore(req);
    const supabase = await createServerSupabaseClient(req);

    // 2. Authorize File Ownership
    // Check if relativePath is stored as supabase:// or local:// or raw relative path
    const fileOwnerId = await (store as any).getFileOwnerTeacherId?.(relativePath) ||
      await (store as any).getFileOwnerTeacherId?.(`supabase://scripts/${relativePath}`) ||
      await (store as any).getFileOwnerTeacherId?.(`supabase://reference_docs/${relativePath}`) ||
      await (store as any).getFileOwnerTeacherId?.(`local://${relativePath}`);

    if (fileOwnerId && fileOwnerId !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to view or download files belonging to another teacher."
      );
    }

    // 3. Retrieve Private File Buffer
    let file = await getPrivateFile(relativePath, {
      teacherId: teacher.id,
      supabaseClient: supabase,
    });

    if (!file && !relativePath.startsWith("supabase://")) {
      // Try resolving via supabase uri
      const bucket = relativePath.startsWith("papers/") || relativePath.startsWith("schemes/")
        ? "reference_docs"
        : "scripts";
      file = await getPrivateFile(`supabase://${bucket}/${relativePath}`, {
        teacherId: teacher.id,
        supabaseClient: supabase,
      });
    }

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": file.buffer.length.toString(),
        "Cache-Control": "private, max-age=3600, no-transform",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error accessing file";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
