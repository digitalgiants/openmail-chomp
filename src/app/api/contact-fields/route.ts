import { NextResponse } from "next/server";
import { createCustomField, listCustomFields } from "@/lib/repository/contact-field-store";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ fields: await listCustomFields(session.organizationId) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  try {
    const field = await createCustomField(session.organizationId, { name, fieldType: body.fieldType });
    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "A field with this name already exists" }, { status: 409 });
    }
    throw error;
  }
}
