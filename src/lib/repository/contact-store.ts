import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contacts } from "@/db/schema";

export const listContacts = (organizationId: string) =>
  db.select().from(contacts).where(eq(contacts.organizationId, organizationId)).orderBy(desc(contacts.createdAt));

export async function getContact(organizationId: string, id: string) {
  const [row] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId)));
  return row ?? null;
}

export interface ContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  status?: string;
}

export async function createContact(organizationId: string, input: ContactInput) {
  const [row] = await db.insert(contacts).values({ organizationId, ...input }).returning();
  return row;
}

export async function updateContact(organizationId: string, id: string, input: Partial<ContactInput>) {
  const [row] = await db.update(contacts).set({ ...input, updatedAt: new Date() }).where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId))).returning();
  return row ?? null;
}

export async function deleteContact(organizationId: string, id: string) {
  const deleted = await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId))).returning({ id: contacts.id });
  return deleted.length > 0;
}

// Unauthenticated-by-design lookups for the public /unsubscribe flow — the
// recipient clicking the link in their email isn't signed into the app at
// all, and the contact's id (a UUID primary key) is already globally
// unique, so no organizationId scoping is needed or available here.
export async function getContactById(id: string) {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
  return row ?? null;
}

export async function unsubscribeContactById(id: string) {
  const [row] = await db.update(contacts).set({ status: "unsubscribed", updatedAt: new Date() }).where(eq(contacts.id, id)).returning();
  return row ?? null;
}
