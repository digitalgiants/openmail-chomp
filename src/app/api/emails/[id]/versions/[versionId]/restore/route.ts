import { NextResponse } from "next/server";
import { restoreEmailVersion } from "@/lib/repository/email-store";
import { requireSession } from "@/lib/auth/session";

export async function POST(_r: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, versionId } = await params;
  const email = await restoreEmailVersion(session.organizationId, id, versionId, session.user.id);
  return email ? NextResponse.json(email) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
