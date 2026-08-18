import { NextResponse } from "next/server";
import { deleteContact, getContact, updateContact } from "@/lib/repository/contact-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contact = await getContact(session.organizationId, (await params).id);
  return contact ? NextResponse.json(contact) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await r.json();
  const contact = await updateContact(session.organizationId, (await params).id, {
    ...(body.email !== undefined ? { email: String(body.email).trim().toLowerCase() } : {}),
    ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
    ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  });
  return contact ? NextResponse.json(contact) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const deleted = await deleteContact(session.organizationId, (await params).id);
  return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
