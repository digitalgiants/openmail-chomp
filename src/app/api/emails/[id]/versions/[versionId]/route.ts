import { NextResponse } from "next/server";
import { getEmailVersion } from "@/lib/repository/email-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, versionId } = await params;
  const version = await getEmailVersion(session.organizationId, id, versionId);
  return version ? NextResponse.json(version) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
