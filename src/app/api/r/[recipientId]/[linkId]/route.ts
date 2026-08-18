import { NextResponse } from "next/server";
import { getLinkById } from "@/lib/repository/link-store";
import { recordClickEvent } from "@/lib/repository/campaign-store";

// Public, unauthenticated redirect hit by recipients clicking a tracked
// link in an email -- there is no signed-in session at this point.
export async function GET(request: Request, { params }: { params: Promise<{ recipientId: string; linkId: string }> }) {
  const { recipientId, linkId } = await params;
  const link = await getLinkById(linkId);
  if (!link) return NextResponse.redirect(new URL("/", request.url));

  if (link.trackingEnabled) {
    // A logging failure should never block the redirect the recipient is
    // actually waiting on.
    recordClickEvent(recipientId, linkId).catch(() => {});
  }

  return NextResponse.redirect(link.destinationUrl);
}
