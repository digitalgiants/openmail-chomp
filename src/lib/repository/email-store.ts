import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emails, emailVersions, user } from "@/db/schema";
import type { EmailDocument } from "@/lib/email";

// Autosave fires ~800ms after every pause in typing, which would flood
// history with one row per keystroke pause if every save snapshotted a
// version. Instead, at most one checkpoint is kept per this window of
// active editing -- still enough granularity to recover from a bad edit
// without drowning the list in near-duplicate versions.
const VERSION_SNAPSHOT_INTERVAL_MS = 3 * 60 * 1000;

async function latestVersionNumber(emailId: string) {
  const [latest] = await db.select({ versionNumber: emailVersions.versionNumber, createdAt: emailVersions.createdAt })
    .from(emailVersions).where(eq(emailVersions.emailId, emailId)).orderBy(desc(emailVersions.versionNumber)).limit(1);
  return latest;
}

async function maybeSnapshotVersion(emailId: string, previousDocument: EmailDocument, userId?: string | null) {
  const latest = await latestVersionNumber(emailId);
  if (latest && Date.now() - latest.createdAt.getTime() < VERSION_SNAPSHOT_INTERVAL_MS) return;
  await db.insert(emailVersions).values({ emailId, versionNumber: (latest?.versionNumber ?? 0) + 1, document: previousDocument, createdBy: userId ?? undefined });
}

export const listEmails = (organizationId: string) =>
  db.select().from(emails).where(eq(emails.organizationId, organizationId)).orderBy(desc(emails.updatedAt));

export async function getEmail(organizationId: string, id: string) {
  const [row] = await db.select().from(emails).where(and(eq(emails.id, id), eq(emails.organizationId, organizationId)));
  return row ? { ...row, document: row.currentDocument } : null;
}

export async function createEmail(organizationId: string, userId: string, input: { name: string; description?: string; document: EmailDocument }) {
  const [row] = await db.insert(emails).values({
    organizationId,
    createdBy: userId,
    name: input.name,
    description: input.description,
    currentDocument: input.document,
  }).returning();
  return { ...row, document: row.currentDocument };
}

export async function updateEmail(organizationId: string, id: string, userId: string | null, input: Partial<{ name: string; description: string; document: EmailDocument; status: string }>) {
  if (input.document !== undefined) {
    const existing = await getEmail(organizationId, id);
    if (existing) await maybeSnapshotVersion(id, existing.document, userId);
  }
  const [row] = await db.update(emails).set({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.document !== undefined ? { currentDocument: input.document } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    updatedAt: new Date(),
  }).where(and(eq(emails.id, id), eq(emails.organizationId, organizationId))).returning();
  return row ?? null;
}

export async function listEmailVersions(organizationId: string, emailId: string) {
  const email = await getEmail(organizationId, emailId);
  if (!email) return null;
  return db.select({
    id: emailVersions.id,
    versionNumber: emailVersions.versionNumber,
    createdAt: emailVersions.createdAt,
    createdByName: user.name,
    createdByEmail: user.email,
  }).from(emailVersions).leftJoin(user, eq(emailVersions.createdBy, user.id)).where(eq(emailVersions.emailId, emailId)).orderBy(desc(emailVersions.versionNumber));
}

export async function getEmailVersion(organizationId: string, emailId: string, versionId: string) {
  const email = await getEmail(organizationId, emailId);
  if (!email) return null;
  const [row] = await db.select().from(emailVersions).where(and(eq(emailVersions.id, versionId), eq(emailVersions.emailId, emailId)));
  return row ?? null;
}

export async function restoreEmailVersion(organizationId: string, emailId: string, versionId: string, userId?: string | null) {
  const email = await getEmail(organizationId, emailId);
  if (!email) return null;
  const [version] = await db.select().from(emailVersions).where(and(eq(emailVersions.id, versionId), eq(emailVersions.emailId, emailId)));
  if (!version) return null;

  // Snapshot the current live state before overwriting it, unconditionally
  // (bypassing the usual throttle window) -- restoring is exactly the
  // moment you most need a way back to what was on the canvas a second ago.
  const latest = await latestVersionNumber(emailId);
  await db.insert(emailVersions).values({ emailId, versionNumber: (latest?.versionNumber ?? 0) + 1, document: email.document, createdBy: userId ?? undefined });

  const [row] = await db.update(emails).set({ currentDocument: version.document, updatedAt: new Date() }).where(and(eq(emails.id, emailId), eq(emails.organizationId, organizationId))).returning();
  return row ? { ...row, document: row.currentDocument } : null;
}
