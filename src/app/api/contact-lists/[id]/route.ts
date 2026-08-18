import { NextResponse } from "next/server";
import { deleteContactList, updateContactList } from "@/lib/repository/contact-list-store";
import { requireSession } from "@/lib/auth/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const list = await updateContactList(session.organizationId, (await params).id, {
    ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
  });
  return list ? NextResponse.json(list) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const deleted = await deleteContactList(session.organizationId, (await params).id);
  return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
