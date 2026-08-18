import { NextResponse } from "next/server";
import { getLocalStorageProvider } from "@/lib/storage";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new NextResponse("Missing key", { status: 400 });
  try {
    const body = await getLocalStorageProvider().read(key);
    const ext = key.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
    return new NextResponse(body as unknown as BodyInit, { headers: { "Content-Type": types[ext ?? ""] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch { return new NextResponse("Not found", { status: 404 }); }
}
