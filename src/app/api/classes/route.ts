import { NextResponse } from "next/server";
import { serverStore } from "@/lib/db/server-store";

export async function GET() {
  try {
    const classes = serverStore.getClasses();
    return NextResponse.json({ success: true, classes });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch classes";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: "Class name is required" }, { status: 400 });
    }

    if (body.id) {
      const updated = serverStore.updateClass(body.id, {
        name: body.name,
        grade_level: body.grade_level || "Grade 10",
        section: body.section || "A",
        academic_year: body.academic_year || "2026-2027",
      });
      return NextResponse.json({ success: true, class: updated });
    }

    const created = serverStore.createClass({
      name: body.name,
      grade_level: body.grade_level || "Grade 10",
      section: body.section || "A",
      academic_year: body.academic_year || "2026-2027",
    });

    return NextResponse.json({ success: true, class: created });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save class";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
