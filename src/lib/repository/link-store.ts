import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { links } from "@/db/schema";

export type StoredLink = typeof links.$inferSelect;

export const listLinks = (organizationId: string) =>
  db.select().from(links).where(eq(links.organizationId, organizationId)).orderBy(desc(links.updatedAt));

export async function getLink(organizationId: string, id: string) {
  const [row] = await db.select().from(links).where(and(eq(links.id, id), eq(links.organizationId, organizationId)));
  return row ?? null;
}

export interface LinkInput {
  name: string; description?: string; destinationUrl: string; trackingEnabled: boolean;
  utmSource?: string; utmMedium?: string; utmCampaign?: string; utmTerm?: string; utmContent?: string;
}

export async function createLink(organizationId: string, input: LinkInput) {
  const [row] = await db.insert(links).values({ organizationId, ...input }).returning();
  return row;
}

export async function updateLink(organizationId: string, id: string, input: Partial<LinkInput>) {
  const [row] = await db.update(links).set({ ...input, updatedAt: new Date() }).where(and(eq(links.id, id), eq(links.organizationId, organizationId))).returning();
  return row ?? null;
}

export async function deleteLink(organizationId: string, id: string) {
  const deleted = await db.delete(links).where(and(eq(links.id, id), eq(links.organizationId, organizationId))).returning({ id: links.id });
  return deleted.length > 0;
}
