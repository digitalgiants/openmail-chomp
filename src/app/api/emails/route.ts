import { NextResponse } from "next/server";
import { listEmails, createEmail } from "@/lib/repository/email-store";
import { starterEmailDocument } from "@/lib/email/defaults";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listEmails(session.organizationId));
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const email = await createEmail(session.organizationId, session.user.id, {
    name: body.name ?? "Untitled Email",
    description: body.description,
    document: body.document ?? starterEmailDocument(),
  });
  return NextResponse.json(email, { status: 201 });
}
