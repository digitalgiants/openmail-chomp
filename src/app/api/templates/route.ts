import { NextResponse } from "next/server";
import { createTemplate, listTemplates } from "@/lib/repository/library-store";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listTemplates(session.organizationId));
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name || !body.document) return NextResponse.json({ error: "name and document are required" }, { status: 400 });
  const template = await createTemplate(session.organizationId, session.user.id, { name: body.name, description: body.description, category: body.category, document: body.document });
  return NextResponse.json(template, { status: 201 });
}
