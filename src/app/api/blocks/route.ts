import { NextResponse } from "next/server";
import { createBlock, listBlocksWithVersions } from "@/lib/repository/library-store";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listBlocksWithVersions(session.organizationId));
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name || !body.component) return NextResponse.json({ error: "name and component are required" }, { status: 400 });
  const block = await createBlock(session.organizationId, session.user.id, { name: body.name, description: body.description, category: body.category, component: body.component });
  return NextResponse.json(block, { status: 201 });
}
