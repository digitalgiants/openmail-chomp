import { NextResponse } from "next/server";
import { getEmail, updateEmail } from "@/lib/repository/email-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const e = await getEmail(session.organizationId, id);
  return e ? NextResponse.json(e) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const e = await updateEmail(session.organizationId, id, await r.json());
  return e ? NextResponse.json(e) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
