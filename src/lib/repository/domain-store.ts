import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailDomains } from "@/db/schema";
import { createResendDomain, deleteResendDomain, getResendDomain, verifyResendDomain, type ResendDomainRecord } from "@/lib/delivery/resend-domains";

interface StoredVerification {
  providerId: string;
  records: ResendDomainRecord[];
}

function verificationOf(row: { verificationRecords: unknown }): StoredVerification | null {
  const v = row.verificationRecords as StoredVerification | null;
  return v?.providerId ? v : null;
}

export const listDomains = (organizationId: string) =>
  db.select().from(emailDomains).where(eq(emailDomains.organizationId, organizationId)).orderBy(desc(emailDomains.createdAt));

export async function getDomain(organizationId: string, id: string) {
  const [row] = await db.select().from(emailDomains).where(and(eq(emailDomains.id, id), eq(emailDomains.organizationId, organizationId)));
  return row ?? null;
}

export async function addDomain(organizationId: string, domain: string) {
  const resendDomain = await createResendDomain(domain);
  const [row] = await db.insert(emailDomains).values({
    organizationId,
    domain,
    provider: "resend",
    status: resendDomain.status,
    verificationRecords: { providerId: resendDomain.id, records: resendDomain.records ?? [] },
  }).returning();
  return row;
}

// Re-fetches status/records from Resend and updates the local copy --
// nothing here is guessed locally, DNS propagation is entirely something
// Resend checks on their end.
export async function refreshDomainStatus(organizationId: string, id: string) {
  const existing = await getDomain(organizationId, id);
  if (!existing) return null;
  const verification = verificationOf(existing);
  if (!verification) return existing;
  const resendDomain = await getResendDomain(verification.providerId);
  const [row] = await db.update(emailDomains).set({
    status: resendDomain.status,
    verificationRecords: { providerId: verification.providerId, records: resendDomain.records ?? [] },
    updatedAt: new Date(),
  }).where(eq(emailDomains.id, id)).returning();
  return row ?? existing;
}

export async function triggerVerification(organizationId: string, id: string) {
  const existing = await getDomain(organizationId, id);
  if (!existing) return null;
  const verification = verificationOf(existing);
  if (!verification) return existing;
  await verifyResendDomain(verification.providerId);
  return refreshDomainStatus(organizationId, id);
}

export async function removeDomain(organizationId: string, id: string) {
  const existing = await getDomain(organizationId, id);
  if (!existing) return false;
  const verification = verificationOf(existing);
  if (verification) {
    // Best-effort -- if Resend already doesn't know about this domain (or
    // the API call fails for some other reason), the local row should
    // still go away rather than getting stuck.
    await deleteResendDomain(verification.providerId).catch(() => {});
  }
  await db.delete(emailDomains).where(and(eq(emailDomains.id, id), eq(emailDomains.organizationId, organizationId)));
  return true;
}
