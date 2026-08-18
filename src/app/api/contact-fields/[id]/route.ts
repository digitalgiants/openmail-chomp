import { NextResponse } from "next/server";
import { deleteCustomField, renameCustomField } from "@/lib/repository/contact-field-store";
import { requireSession } from "@/lib/auth/session";

export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await r.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const field = await renameCustomField(session.organizationId, (await params).id, name);
  return field ? NextResponse.json(field) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const deleted = await deleteCustomField(session.organizationId, (await params).id);
  return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
