import { NextResponse } from "next/server";
import { getPrivateFile } from "@/lib/storage/file-storage";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/server-auth";
import { serverStore } from "@/lib/db/server-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];
    const relativePath = pathSegments.join("/");

    if (!relativePath) {
      return NextResponse.json({ error: "Missing file path" }, { status: 400 });
    }

    // 1. Authenticate Teacher
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) {
      return unauthorizedResponse("Authentication required to access student scripts or schemes.");
    }

    // If explicit header demands live session or forbids fallback
    if (req.headers.get("x-allow-fallback") === "false" && teacher.source === "fallback") {
      return unauthorizedResponse("Authentication required: Live session or credentials required.");
    }

    // 2. Authorize File Ownership
    const fileOwnerId = serverStore.getFileOwnerTeacherId(relativePath);
    if (fileOwnerId && fileOwnerId !== teacher.id) {
      return forbiddenResponse(
        "Access denied: You do not have permission to view or download files belonging to another teacher."
      );
    }

    // 3. Retrieve Private File Buffer
    const file = await getPrivateFile(relativePath);

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
