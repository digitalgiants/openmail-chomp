import { NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { createAsset, listAssets } from "@/lib/assets/store";
import { imageInfo } from "@/lib/assets/image-info";
import { getStorageProvider } from "@/lib/storage";
import { requireSession } from "@/lib/auth/session";

const allowed = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]);
const maxBytes = 15 * 1024 * 1024;

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ assets: await listAssets(session.organizationId) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!allowed.has(file.type)) return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  if (file.size > maxBytes) return NextResponse.json({ error: "Maximum file size is 15 MB" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const ext = path.extname(file.name).toLowerCase() || ".img";
  const key = `${session.organizationId}/${new Date().getFullYear()}/${hash}-${crypto.randomUUID()}${ext}`;

  const storageProviderName = process.env.STORAGE_PROVIDER === "r2" ? "r2" : "local";
  const storage = getStorageProvider();
  const stored = await storage.upload({ key, body: buffer, contentType: file.type });
  const info = imageInfo(buffer, file.type);

  const asset = await createAsset(session.organizationId, session.user.id, {
    filename: file.name,
    originalFilename: file.name,
    mimeType: file.type,
    fileSize: file.size,
    ...info,
    storageProvider: storageProviderName,
    storageKey: key,
    publicUrl: stored.url ?? "",
    altText: String(form.get("altText") ?? ""),
  });
  return NextResponse.json({ asset }, { status: 201 });
}
