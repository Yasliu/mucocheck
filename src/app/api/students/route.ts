import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") || undefined;
    const students = serverStore.getStudents(classId);
    return NextResponse.json({ success: true, students });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch students";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.full_name || !body.roll_number || !body.class_id) {
      return NextResponse.json(
        { error: "full_name, roll_number, and class_id are required" },
        { status: 400 }
      );
    }

    if (body.id) {
      const updated = serverStore.updateStudent(body.id, {
        full_name: body.full_name,
        roll_number: body.roll_number,
        email: body.email,
        class_id: body.class_id,
      });
      return NextResponse.json({ success: true, student: updated });
    }

    const created = serverStore.createStudent({
      full_name: body.full_name,
      roll_number: body.roll_number,
      class_id: body.class_id,
      email: body.email,
    });

    return NextResponse.json({ success: true, student: created });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save student";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
