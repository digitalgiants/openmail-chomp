import { NextResponse } from "next/server";
import { refreshDomainStatus, removeDomain } from "@/lib/repository/domain-store";
import { requireSession } from "@/lib/auth/session";

// Re-checks status/records against Resend on every GET rather than just
// reading the local row -- domain verification is only useful if it
// reflects DNS propagation, not whatever was true at add-time.
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const row = await refreshDomainStatus(session.organizationId, (await params).id);
    return row ? NextResponse.json(row) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check domain status" }, { status: 502 });
  }
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const deleted = await removeDomain(session.organizationId, (await params).id);
  return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
