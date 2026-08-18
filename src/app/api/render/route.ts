import { NextResponse } from "next/server";
import { renderDocument } from "@/lib/email/render";
import type { EmailDocument } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { document: EmailDocument };
    const result = await renderDocument(body.document);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to render email" }, { status: 400 });
  }
}
