import { NextResponse } from "next/server";
import { removeContactFromList } from "@/lib/repository/contact-list-store";
import { requireSession } from "@/lib/auth/session";

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, contactId } = await params;
  const ok = await removeContactFromList(session.organizationId, id, contactId);
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
