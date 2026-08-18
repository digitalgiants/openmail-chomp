import { NextResponse } from "next/server";
import { triggerVerification } from "@/lib/repository/domain-store";
import { requireSession } from "@/lib/auth/session";

export async function POST(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const row = await triggerVerification(session.organizationId, (await params).id);
    return row ? NextResponse.json(row) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not trigger verification" }, { status: 502 });
  }
}
