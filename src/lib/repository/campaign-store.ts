import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { campaignEvents, campaignRecipients, campaignRenderings, campaigns, contacts } from "@/db/schema";
import { getEmail } from "./email-store";
import { renderDocument } from "@/lib/email/render";
import { getDeliveryProvider } from "@/lib/delivery";

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

export async function sendQuickEmail(organizationId: string, emailId: string, recipientEmails: string[]): Promise<QuickSendResult> {
  const email = await getEmail(organizationId, emailId);
  if (!email) throw new Error("Email not found");

  const subject = email.document.metadata.subject || email.name;
  const { html } = await renderDocument(email.document);
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
    try {
      await provider.send({ from, to: [recipientEmail], subject, html: withUnsubscribeFooter(html, unsubscribeUrl) });
      await db.update(campaignRecipients).set({ status: "sent" }).where(eq(campaignRecipients.id, recipient.id));
      await db.insert(campaignEvents).values({ campaignId: campaign.id, campaignRecipientId: recipient.id, eventType: "sent" });
      results.push({ email: recipientEmail, status: "sent" });
    } catch (error) {
      await db.update(campaignRecipients).set({ status: "failed" }).where(eq(campaignRecipients.id, recipient.id));
      await db.insert(campaignEvents).values({ campaignId: campaign.id, campaignRecipientId: recipient.id, eventType: "failed", metadata: { error: error instanceof Error ? error.message : String(error) } });
      results.push({ email: recipientEmail, status: "failed", error: error instanceof Error ? error.message : "Send failed" });
    }
  }

  const sentCount = results.filter(r => r.status === "sent").length;
  const failedCount = results.filter(r => r.status === "failed").length;
  const campaignStatus = sentCount > 0 ? "sent" : failedCount > 0 ? "failed" : "skipped";
  await db.update(campaigns).set({ status: campaignStatus, updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));

  return { campaignId: campaign.id, results };
}
