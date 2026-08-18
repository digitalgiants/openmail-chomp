import { NextResponse } from "next/server";
import { deleteLink, getLink, updateLink } from "@/lib/repository/link-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const l = await getLink(session.organizationId, (await params).id);
  return l ? NextResponse.json(l) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const l = await updateLink(session.organizationId, (await params).id, await r.json());
  return l ? NextResponse.json(l) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return (await deleteLink(session.organizationId, (await params).id)) ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
