import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { campaignEvents, campaignRecipients, campaignRenderings, campaigns, contacts } from "@/db/schema";
import { getEmail } from "./email-store";
import { renderDocument, RECIPIENT_TOKEN } from "@/lib/email/render";
import { getDeliveryProvider } from "@/lib/delivery";
import type { EmailMessage } from "@/lib/delivery/types";

export interface QuickSendResult {
  campaignId: string;
  results: { email: string; status: "sent" | "failed" | "skipped"; error?: string }[];
}

async function upsertContactByEmail(organizationId: string, email: string) {
  const [existing] = await db.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.email, email)));
  if (existing) return existing;
  const [created] = await db.insert(contacts).values({ organizationId, email }).returning();
  return created;
}

function withUnsubscribeFooter(html: string, unsubscribeUrl: string) {
  const footer = `<div style="padding:16px;text-align:center;font-size:12px;color:#71717a;font-family:Arial,Helvetica,sans-serif;">You're receiving this email because you subscribed. <a href="${unsubscribeUrl}" style="color:#71717a;">Unsubscribe</a></div>`;
  return html.includes("</body>") ? html.replace("</body>", `${footer}</body>`) : `${html}${footer}`;
}

// The base HTML is compiled once per campaign with a placeholder in every
// tracked link (see RECIPIENT_TOKEN in render.ts) -- this swaps in the real
// campaignRecipients row id per recipient, which is far cheaper than
// re-running mjml2html for every send.
function withRecipientToken(html: string, recipientRowId: string) {
  return html.split(RECIPIENT_TOKEN).join(recipientRowId);
}

export async function sendQuickEmail(organizationId: string, emailId: string, recipientEmails: string[]): Promise<QuickSendResult> {
  const email = await getEmail(organizationId, emailId);
  if (!email) throw new Error("Email not found");

  const subject = email.document.metadata.subject || email.name;
  const trackingBase = `${process.env.BETTER_AUTH_URL}/api/r`;
  const { html } = await renderDocument(email.document, { trackingBase });
  const from = process.env.EMAIL_FROM || "VaultFoundry <onboarding@resend.dev>";

  const [campaign] = await db.insert(campaigns).values({
    organizationId,
    emailId: email.id,
    name: `Quick send: ${email.name} — ${new Date().toLocaleString()}`,
    status: "sending",
    fromEmail: from,
    subject,
    deliveryProvider: "resend",
  }).returning();

  await db.insert(campaignRenderings).values({ campaignId: campaign.id, html, subject });

  const provider = getDeliveryProvider();
  const uniqueEmails = [...new Set(recipientEmails.map(e => e.trim().toLowerCase()).filter(Boolean))];
  const results: QuickSendResult["results"] = [];

  // Resolve every recipient and create their campaignRecipients row first
  // (local DB round-trips, fast even for large lists). Unsubscribed
  // contacts are skipped immediately and never enter the send queue.
  const toSend: { recipientEmail: string; recipientRowId: string; message: EmailMessage }[] = [];
  for (const recipientEmail of uniqueEmails) {
    const contact = await upsertContactByEmail(organizationId, recipientEmail);
    const [recipient] = await db.insert(campaignRecipients).values({
      campaignId: campaign.id,
      contactId: contact.id,
      email: recipientEmail,
      firstName: contact.firstName,
      lastName: contact.lastName,
      status: "pending",
    }).returning();

    if (contact.status === "unsubscribed") {
      await db.update(campaignRecipients).set({ status: "skipped" }).where(eq(campaignRecipients.id, recipient.id));
      await db.insert(campaignEvents).values({ campaignId: campaign.id, campaignRecipientId: recipient.id, eventType: "skipped", metadata: { reason: "unsubscribed" } });
      results.push({ email: recipientEmail, status: "skipped", error: "Unsubscribed" });
      continue;
    }

    const unsubscribeUrl = `${process.env.BETTER_AUTH_URL}/unsubscribe?contact=${contact.id}`;
    const recipientHtml = withUnsubscribeFooter(withRecipientToken(html, recipient.id), unsubscribeUrl);
    toSend.push({
      recipientEmail,
      recipientRowId: recipient.id,
      message: { from, to: [recipientEmail], subject, html: recipientHtml },
    });
  }

  // Actual delivery goes through Resend's batch endpoint (up to 100
  // messages per call) instead of one HTTP round-trip per recipient --
  // for a real-sized list, that's the difference between a handful of
  // requests and potentially thousands, which is what actually risked
  // request timeouts and rate limits before.
  const BATCH_SIZE = 100;
  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    const chunk = toSend.slice(i, i + BATCH_SIZE);
    try {
      // Resend's batch endpoint returns results positionally, in the same
      // order the messages were submitted -- there's no per-message id
      // echoed back in the request, so this ordering is load-bearing.
      const sendResults = await provider.sendBatch(chunk.map(c => c.message));
      for (let j = 0; j < chunk.length; j++) {
        const c = chunk[j];
        const providerMessageId = sendResults[j]?.id;
        await db.update(campaignRecipients).set({ status: "sent", providerMessageId }).where(eq(campaignRecipients.id, c.recipientRowId));
        await db.insert(campaignEvents).values({ campaignId: campaign.id, campaignRecipientId: c.recipientRowId, eventType: "sent" });
        results.push({ email: c.recipientEmail, status: "sent" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed";
      for (const c of chunk) {
        await db.update(campaignRecipients).set({ status: "failed" }).where(eq(campaignRecipients.id, c.recipientRowId));
        await db.insert(campaignEvents).values({ campaignId: campaign.id, campaignRecipientId: c.recipientRowId, eventType: "failed", metadata: { error: message } });
        results.push({ email: c.recipientEmail, status: "failed", error: message });
      }
    }
  }

  const sentCount = results.filter(r => r.status === "sent").length;
  const failedCount = results.filter(r => r.status === "failed").length;
  const campaignStatus = sentCount > 0 ? "sent" : failedCount > 0 ? "failed" : "skipped";
  await db.update(campaigns).set({ status: campaignStatus, updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));

  return { campaignId: campaign.id, results };
}

export async function listCampaigns(organizationId: string) {
  const rows = await db.select().from(campaigns).where(eq(campaigns.organizationId, organizationId)).orderBy(desc(campaigns.createdAt));
  if (rows.length === 0) return [];
  const campaignIds = rows.map(r => r.id);
  const counts = await db.select({ campaignId: campaignRecipients.campaignId, status: campaignRecipients.status, value: count() })
    .from(campaignRecipients)
    .where(inArray(campaignRecipients.campaignId, campaignIds))
    .groupBy(campaignRecipients.campaignId, campaignRecipients.status);
  const countMap = new Map<string, Record<string, number>>();
  for (const c of counts) {
    const existing = countMap.get(c.campaignId) ?? {};
    existing[c.status] = c.value;
    countMap.set(c.campaignId, existing);
  }
  // Opens/clicks are counted per distinct recipient (not per event) so a
  // recipient opening the same email five times still reads as "1 opened".
  const engagement = await db.selectDistinct({ campaignId: campaignEvents.campaignId, recipientId: campaignEvents.campaignRecipientId, eventType: campaignEvents.eventType })
    .from(campaignEvents)
    .where(and(inArray(campaignEvents.campaignId, campaignIds), inArray(campaignEvents.eventType, ["opened", "clicked"])));
  const engagementMap = new Map<string, { opened: number; clicked: number }>();
  for (const e of engagement) {
    const existing = engagementMap.get(e.campaignId) ?? { opened: 0, clicked: 0 };
    if (e.eventType === "opened") existing.opened += 1;
    if (e.eventType === "clicked") existing.clicked += 1;
    engagementMap.set(e.campaignId, existing);
  }
  return rows.map(r => ({ ...r, recipientCounts: countMap.get(r.id) ?? {}, engagement: engagementMap.get(r.id) ?? { opened: 0, clicked: 0 } }));
}

// Called from the public /api/r/[recipientId]/[linkId] redirect route --
// unauthenticated by design, same reasoning as getLinkById.
export async function recordClickEvent(recipientId: string, linkId: string) {
  const [recipient] = await db.select({ campaignId: campaignRecipients.campaignId }).from(campaignRecipients).where(eq(campaignRecipients.id, recipientId));
  if (!recipient) return;
  await db.insert(campaignEvents).values({ campaignId: recipient.campaignId, campaignRecipientId: recipientId, eventType: "clicked", linkId });
}

// Called from the Resend webhook route to match an incoming event back to
// the recipient it belongs to. Also unauthenticated by design -- the
// webhook is called by Resend, not a signed-in user.
export async function recordEventByProviderMessageId(providerMessageId: string, eventType: string, metadata?: unknown) {
  const [recipient] = await db.select({ id: campaignRecipients.id, campaignId: campaignRecipients.campaignId }).from(campaignRecipients).where(eq(campaignRecipients.providerMessageId, providerMessageId));
  if (!recipient) return false;
  await db.insert(campaignEvents).values({ campaignId: recipient.campaignId, campaignRecipientId: recipient.id, eventType, metadata });
  return true;
}

export async function getCampaignWithRecipients(organizationId: string, id: string) {
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)));
  if (!campaign) return null;
  const recipients = await db.select().from(campaignRecipients).where(eq(campaignRecipients.campaignId, id)).orderBy(campaignRecipients.email);
  const engagement = await db.selectDistinct({ recipientId: campaignEvents.campaignRecipientId, eventType: campaignEvents.eventType })
    .from(campaignEvents)
    .where(and(eq(campaignEvents.campaignId, id), inArray(campaignEvents.eventType, ["opened", "clicked"])));
  const engagementMap = new Map<string, { opened: boolean; clicked: boolean }>();
  for (const e of engagement) {
    const existing = engagementMap.get(e.recipientId) ?? { opened: false, clicked: false };
    if (e.eventType === "opened") existing.opened = true;
    if (e.eventType === "clicked") existing.clicked = true;
    engagementMap.set(e.recipientId, existing);
  }
  return { ...campaign, recipients: recipients.map(r => ({ ...r, ...(engagementMap.get(r.id) ?? { opened: false, clicked: false }) })) };
}
