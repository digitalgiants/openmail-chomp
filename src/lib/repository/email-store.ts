import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emails } from "@/db/schema";
import type { EmailDocument } from "@/lib/email";

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

export async function updateEmail(organizationId: string, id: string, input: Partial<{ name: string; description: string; document: EmailDocument; status: string }>) {
  const [row] = await db.update(emails).set({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.document !== undefined ? { currentDocument: input.document } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    updatedAt: new Date(),
  }).where(and(eq(emails.id, id), eq(emails.organizationId, organizationId))).returning();
  return row ?? null;
}
