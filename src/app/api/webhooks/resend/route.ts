import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { recordEventByProviderMessageId } from "@/lib/repository/campaign-store";

// Resend delivers webhooks Svix-signed rather than signing them itself.
// Verified manually here (HMAC-SHA256 per the Svix spec) instead of pulling
// in the `svix` package for three lines of crypto.
const EVENT_TYPE_MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

function verifySignature(body: string, headers: Headers, secret: string): boolean {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Reject anything older than 5 minutes -- Resend/Svix deliveries are
  // near-instant, so a stale timestamp signals a replay attempt rather
  // than a slow retry.
  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const secretBytes = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected);

  return svixSignature.split(" ").some(part => {
    const [, signature] = part.split(",");
    if (!signature) return false;
    const actualBuf = Buffer.from(signature);
    return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
  });
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const body = await request.text();
  if (!verifySignature(body, request.headers, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { type?: string; data?: { email_id?: string; [key: string]: unknown } };
  const eventType = payload.type ? EVENT_TYPE_MAP[payload.type] : undefined;
  const providerMessageId = payload.data?.email_id;
  if (eventType && providerMessageId) {
    await recordEventByProviderMessageId(providerMessageId, eventType, payload.data);
  }

  return NextResponse.json({ received: true });
}
