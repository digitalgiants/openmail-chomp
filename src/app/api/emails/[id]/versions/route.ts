import { NextResponse } from "next/server";
import { listEmailVersions } from "@/lib/repository/email-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const versions = await listEmailVersions(session.organizationId, id);
  return versions ? NextResponse.json({ versions }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
