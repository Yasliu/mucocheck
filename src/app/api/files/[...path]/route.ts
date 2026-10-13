import { NextResponse } from "next/server";
import { getPrivateFile } from "@/lib/storage/file-storage";

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

    const file = await getPrivateFile(relativePath);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": file.buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error accessing file";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
