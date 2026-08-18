import { NextResponse } from "next/server";
import { deleteBlock, getBlockVersion, getBlockWithVersions, updateBlock } from "@/lib/repository/library-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const versionParam = new URL(req.url).searchParams.get("version");
  if (versionParam) {
    const version = Number(versionParam);
    if (!Number.isInteger(version) || version < 1) return NextResponse.json({ error: "Invalid version" }, { status: 400 });
    const versionItem = await getBlockVersion(session.organizationId, id, version);
    return versionItem ? NextResponse.json(versionItem) : NextResponse.json({ error: "Version not found" }, { status: 404 });
  }
  const item = await getBlockWithVersions(session.organizationId, id);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const updated = await updateBlock(session.organizationId, session.user.id, id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const item = await getBlockWithVersions(session.organizationId, id);
  return NextResponse.json(item);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ deleted: await deleteBlock(session.organizationId, id) });
}
