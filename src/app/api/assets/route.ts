import { NextResponse } from "next/server";
import crypto from "node:crypto";
import path from "node:path";
import { createAsset, listAssets } from "@/lib/assets/store";
import { imageInfo } from "@/lib/assets/image-info";
import { getStorageProvider } from "@/lib/storage";

const allowed = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]);
const maxBytes = 15 * 1024 * 1024;

export async function GET() { return NextResponse.json({ assets: await listAssets() }); }

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!allowed.has(file.type)) return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  if (file.size > maxBytes) return NextResponse.json({ error: "Maximum file size is 15 MB" }, { status: 413 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const ext = path.extname(file.name).toLowerCase() || ".img";
  const key = `${new Date().getFullYear()}/${hash}-${crypto.randomUUID()}${ext}`;
  const storage = getStorageProvider();
  const stored = await storage.upload({ key, body: buffer, contentType: file.type });
  const info = imageInfo(buffer, file.type);
  const asset = await createAsset({ id: crypto.randomUUID(), filename: file.name, originalFilename: file.name, mimeType: file.type, fileSize: file.size, ...info, storageProvider: "local", storageKey: key, publicUrl: stored.url ?? "", altText: String(form.get("altText") ?? ""), tags: [], createdAt: new Date().toISOString() });
  return NextResponse.json({ asset }, { status: 201 });
}
