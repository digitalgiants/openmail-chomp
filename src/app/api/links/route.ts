import { NextResponse } from "next/server";
import { createLink, listLinks } from "@/lib/repository/link-store";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ links: await listLinks(session.organizationId) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.name?.trim() || !body.destinationUrl?.trim()) return NextResponse.json({ error: "Name and destination URL are required." }, { status: 400 });
  const link = await createLink(session.organizationId, {
    name: body.name.trim(), description: body.description?.trim(), destinationUrl: body.destinationUrl.trim(),
    trackingEnabled: body.trackingEnabled !== false, utmSource: body.utmSource, utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign, utmTerm: body.utmTerm, utmContent: body.utmContent,
  });
  return NextResponse.json(link, { status: 201 });
}
