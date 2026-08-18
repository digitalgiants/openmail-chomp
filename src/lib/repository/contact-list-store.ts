import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contactListMembers, contactLists, contacts } from "@/db/schema";

export async function listContactLists(organizationId: string) {
  const lists = await db.select().from(contactLists).where(eq(contactLists.organizationId, organizationId)).orderBy(contactLists.name);
  if (lists.length === 0) return [];
  const counts = await db.select({ listId: contactListMembers.listId, value: count() })
    .from(contactListMembers)
    .where(inArray(contactListMembers.listId, lists.map(l => l.id)))
    .groupBy(contactListMembers.listId);
  const countMap = new Map(counts.map(c => [c.listId, c.value]));
  return lists.map(l => ({ ...l, memberCount: countMap.get(l.id) ?? 0 }));
}

export async function getContactList(organizationId: string, id: string) {
  const [row] = await db.select().from(contactLists).where(and(eq(contactLists.id, id), eq(contactLists.organizationId, organizationId)));
  return row ?? null;
}

export async function createContactList(organizationId: string, input: { name: string; description?: string }) {
  const [row] = await db.insert(contactLists).values({ organizationId, ...input }).returning();
  return row;
}

export async function updateContactList(organizationId: string, id: string, input: Partial<{ name: string; description: string }>) {
  const [row] = await db.update(contactLists).set({ ...input, updatedAt: new Date() }).where(and(eq(contactLists.id, id), eq(contactLists.organizationId, organizationId))).returning();
  return row ?? null;
}

export async function deleteContactList(organizationId: string, id: string) {
  const deleted = await db.delete(contactLists).where(and(eq(contactLists.id, id), eq(contactLists.organizationId, organizationId))).returning({ id: contactLists.id });
  return deleted.length > 0;
}

export async function listMembersOfList(organizationId: string, listId: string) {
  const list = await getContactList(organizationId, listId);
  if (!list) return null;
  const rows = await db.select({ contact: contacts }).from(contactListMembers)
    .innerJoin(contacts, eq(contacts.id, contactListMembers.contactId))
    .where(eq(contactListMembers.listId, listId));
  return rows.map(r => r.contact);
}

export async function addContactsToList(organizationId: string, listId: string, contactIds: string[]) {
  const list = await getContactList(organizationId, listId);
  if (!list) return false;
  if (contactIds.length > 0) {
    await db.insert(contactListMembers).values(contactIds.map(contactId => ({ contactId, listId }))).onConflictDoNothing();
  }
  return true;
}

export async function removeContactFromList(organizationId: string, listId: string, contactId: string) {
  const list = await getContactList(organizationId, listId);
  if (!list) return false;
  await db.delete(contactListMembers).where(and(eq(contactListMembers.listId, listId), eq(contactListMembers.contactId, contactId)));
  return true;
}
