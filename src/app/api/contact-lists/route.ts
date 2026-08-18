import { NextResponse } from "next/server";
import { createContactList, listContactLists } from "@/lib/repository/contact-list-store";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ lists: await listContactLists(session.organizationId) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const list = await createContactList(session.organizationId, { name, description: body.description?.trim() || undefined });
  return NextResponse.json(list, { status: 201 });
}
