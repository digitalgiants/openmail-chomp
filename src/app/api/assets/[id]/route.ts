import { NextResponse } from "next/server";
import { deleteAsset } from "@/lib/assets/store";
import { getStorageProvider } from "@/lib/storage";
import { requireSession } from "@/lib/auth/session";

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asset = await deleteAsset(session.organizationId, (await params).id);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await getStorageProvider().delete(asset.storageKey);
  } catch {
    // The database row is already gone and that's what the UI reflects;
    // an orphaned storage object is a minor cleanup issue, not worth
    // failing the request the user is waiting on.
  }

  return new NextResponse(null, { status: 204 });
}
