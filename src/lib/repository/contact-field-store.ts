import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contactCustomFields, contactCustomValues } from "@/db/schema";

export const FIELD_TYPES = ["text", "number", "date", "url"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "field";
}

export const listCustomFields = (organizationId: string) =>
  db.select().from(contactCustomFields).where(eq(contactCustomFields.organizationId, organizationId)).orderBy(contactCustomFields.name);

export async function createCustomField(organizationId: string, input: { name: string; fieldType?: string }) {
  const [row] = await db.insert(contactCustomFields).values({
    organizationId,
    name: input.name,
    slug: slugify(input.name),
    fieldType: FIELD_TYPES.includes(input.fieldType as FieldType) ? input.fieldType : "text",
  }).returning();
  return row;
}

export async function renameCustomField(organizationId: string, id: string, name: string) {
  const [row] = await db.update(contactCustomFields).set({ name, slug: slugify(name), updatedAt: new Date() })
    .where(and(eq(contactCustomFields.id, id), eq(contactCustomFields.organizationId, organizationId))).returning();
  return row ?? null;
}

export async function deleteCustomField(organizationId: string, id: string) {
  const [field] = await db.select({ id: contactCustomFields.id }).from(contactCustomFields)
    .where(and(eq(contactCustomFields.id, id), eq(contactCustomFields.organizationId, organizationId)));
  if (!field) return false;
  // No cascade at the DB level, so the dependent values have to go first
  // or the field delete hits an FK error.
  await db.delete(contactCustomValues).where(eq(contactCustomValues.fieldId, id));
  await db.delete(contactCustomFields).where(eq(contactCustomFields.id, id));
  return true;
}

export async function getContactCustomValues(organizationId: string, contactId: string) {
  return db.select({ fieldId: contactCustomValues.fieldId, value: contactCustomValues.value })
    .from(contactCustomValues)
    .innerJoin(contactCustomFields, eq(contactCustomFields.id, contactCustomValues.fieldId))
    .where(and(eq(contactCustomValues.contactId, contactId), eq(contactCustomFields.organizationId, organizationId)));
}

export async function setContactCustomValues(organizationId: string, contactId: string, values: Record<string, string | null>) {
  const fieldIds = Object.keys(values);
  if (fieldIds.length === 0) return;
  // fieldId comes straight from client input -- this membership check is
  // the only thing stopping a value being written against another org's
  // field id.
  const validFields = await db.select({ id: contactCustomFields.id }).from(contactCustomFields)
    .where(and(inArray(contactCustomFields.id, fieldIds), eq(contactCustomFields.organizationId, organizationId)));
  const validIds = new Set(validFields.map(f => f.id));

  for (const fieldId of fieldIds) {
    if (!validIds.has(fieldId)) continue;
    const value = values[fieldId];
    if (value === null || value === "") {
      await db.delete(contactCustomValues).where(and(eq(contactCustomValues.contactId, contactId), eq(contactCustomValues.fieldId, fieldId)));
    } else {
      await db.insert(contactCustomValues).values({ contactId, fieldId, value })
        .onConflictDoUpdate({ target: [contactCustomValues.contactId, contactCustomValues.fieldId], set: { value } });
    }
  }
}

// Called from contact-store's deleteContact so a deleted contact's values
// don't dangle behind and violate the contactId FK.
export async function deleteContactCustomValues(contactId: string) {
  await db.delete(contactCustomValues).where(eq(contactCustomValues.contactId, contactId));
}
