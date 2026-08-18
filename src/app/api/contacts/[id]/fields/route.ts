import { NextResponse } from "next/server";
import { getContactCustomValues, setContactCustomValues } from "@/lib/repository/contact-field-store";
import { getContact } from "@/lib/repository/contact-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const contact = await getContact(session.organizationId, id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const values = await getContactCustomValues(session.organizationId, id);
  return NextResponse.json({ values });
}

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const contact = await getContact(session.organizationId, id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await r.json();
  await setContactCustomValues(session.organizationId, id, body.values ?? {});
  return NextResponse.json({ ok: true });
}
