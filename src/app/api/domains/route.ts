import { NextResponse } from "next/server";
import { addDomain, listDomains } from "@/lib/repository/domain-store";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ domains: await listDomains(session.organizationId) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const domain = String(body.domain ?? "").trim().toLowerCase();
  if (!domain) return NextResponse.json({ error: "Domain is required" }, { status: 400 });

  try {
    const row = await addDomain(session.organizationId, domain);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This domain has already been added" }, { status: 409 });
    }
    if (error instanceof Error && error.message.startsWith("RESEND_API_KEY")) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add domain" }, { status: 502 });
  }
}
