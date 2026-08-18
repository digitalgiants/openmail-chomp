import { NextResponse } from "next/server";
import { addContactsToList, listMembersOfList } from "@/lib/repository/contact-list-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const members = await listMembersOfList(session.organizationId, (await params).id);
  return members ? NextResponse.json({ members }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const contactIds: string[] = Array.isArray(body.contactIds) ? body.contactIds : [];
  const ok = await addContactsToList(session.organizationId, (await params).id, contactIds);
  return ok ? NextResponse.json({ added: contactIds.length }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
