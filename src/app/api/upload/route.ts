import { NextResponse } from "next/server";
import { savePrivateFile, validateUploadedFile } from "@/lib/storage/file-storage";
import {
  getAuthenticatedTeacher,
  unauthorizedResponse,
} from "@/lib/auth/server-auth";

export async function POST(req: Request) {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return unauthorizedResponse();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "scripts";

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const validation = validateUploadedFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const validCategory =
      category === "papers" || category === "schemes" ? category : "scripts";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const saved = await savePrivateFile(buffer, file.name, validCategory);

    return NextResponse.json({
      success: true,
      teacherId: teacher.id,
      filePath: saved.relativePath,
      fileName: file.name,
      storedName: saved.fileName,
      fileSize: saved.size,
      mimeType: file.type || "application/octet-stream",
      url: `/api/files/${saved.relativePath}`,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "File upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
