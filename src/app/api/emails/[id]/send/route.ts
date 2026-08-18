import { NextResponse } from "next/server";
import { sendQuickEmail } from "@/lib/repository/campaign-store";
import { requireSession } from "@/lib/auth/session";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const recipientEmails: string[] = Array.isArray(body.recipientEmails) ? body.recipientEmails : [];
  const valid = recipientEmails.map(e => String(e).trim()).filter(e => emailPattern.test(e));
  if (valid.length === 0) return NextResponse.json({ error: "At least one valid recipient email is required" }, { status: 400 });

  try {
    const result = await sendQuickEmail(session.organizationId, id, valid);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send email";
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 500 });
  }
}
