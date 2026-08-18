import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { blocks, blockVersions, templates, templateVersions } from "@/db/schema";
import type { EmailComponent, EmailDocument } from "@/lib/email";

export async function listTemplates(organizationId: string) {
  const rows = await db.select().from(templates).where(eq(templates.organizationId, organizationId)).orderBy(desc(templates.updatedAt));
  if (rows.length === 0) return [];
  const versionRows = await db.select().from(templateVersions).where(inArray(templateVersions.templateId, rows.map(r => r.id))).orderBy(desc(templateVersions.versionNumber));
  const latest = new Map<string, number>();
  for (const v of versionRows) if (!latest.has(v.templateId)) latest.set(v.templateId, v.versionNumber);
  return rows.map(r => ({ ...r, document: r.currentDocument, version: latest.get(r.id) ?? 1 }));
}

export async function getTemplate(organizationId: string, id: string) {
  const [row] = await db.select().from(templates).where(and(eq(templates.id, id), eq(templates.organizationId, organizationId)));
  if (!row) return null;
  const [latest] = await db.select().from(templateVersions).where(eq(templateVersions.templateId, id)).orderBy(desc(templateVersions.versionNumber)).limit(1);
  return { ...row, document: row.currentDocument, version: latest?.versionNumber ?? 1 };
}

export async function createTemplate(organizationId: string, userId: string, input: { name: string; description?: string; category?: string; document: EmailDocument }) {
  const [row] = await db.insert(templates).values({
    organizationId, createdBy: userId, name: input.name, description: input.description, category: input.category, currentDocument: input.document,
  }).returning();
  await db.insert(templateVersions).values({ templateId: row.id, versionNumber: 1, document: input.document, createdBy: userId });
  return { ...row, document: row.currentDocument, version: 1 };
}

export async function deleteTemplate(organizationId: string, id: string) {
  const deleted = await db.delete(templates).where(and(eq(templates.id, id), eq(templates.organizationId, organizationId))).returning({ id: templates.id });
  return deleted.length > 0;
}

export const listBlocks = (organizationId: string) =>
  db.select().from(blocks).where(eq(blocks.organizationId, organizationId)).orderBy(desc(blocks.updatedAt));

export async function listBlocksWithVersions(organizationId: string) {
  const blockRows = await listBlocks(organizationId);
  if (blockRows.length === 0) return [];
  const versionRows = await db.select().from(blockVersions)
    .where(inArray(blockVersions.blockId, blockRows.map(b => b.id)))
    .orderBy(desc(blockVersions.versionNumber));
  const shaped = versionRows.map(v => ({ version: v.versionNumber, component: v.document, createdAt: v.createdAt, blockId: v.blockId }));
  const grouped = new Map<string, typeof shaped>();
  for (const v of shaped) grouped.set(v.blockId, [...(grouped.get(v.blockId) ?? []), v]);
  return blockRows.map(b => {
    const versions = grouped.get(b.id) ?? [];
    return { ...b, component: b.currentDocument, version: versions[0]?.version ?? 1, versions };
  });
}

export async function getBlock(organizationId: string, id: string) {
  const [row] = await db.select().from(blocks).where(and(eq(blocks.id, id), eq(blocks.organizationId, organizationId)));
  return row ?? null;
}

export async function createBlock(organizationId: string, userId: string, input: { name: string; description?: string; category?: string; component: EmailComponent }) {
  const [row] = await db.insert(blocks).values({
    organizationId, createdBy: userId, name: input.name, description: input.description, category: input.category, currentDocument: input.component,
  }).returning();
  await db.insert(blockVersions).values({ blockId: row.id, versionNumber: 1, document: input.component, createdBy: userId });
  return row;
}

export async function updateBlock(organizationId: string, userId: string, id: string, input: Partial<{ name: string; description: string; category: string; component: EmailComponent }>) {
  const current = await getBlock(organizationId, id);
  if (!current) return null;

  const [existingVersions] = await db.select().from(blockVersions).where(eq(blockVersions.blockId, id)).orderBy(desc(blockVersions.versionNumber)).limit(1);
  const nextVersion = (existingVersions?.versionNumber ?? 1) + (input.component ? 1 : 0);

  const [row] = await db.update(blocks).set({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.component !== undefined ? { currentDocument: input.component } : {}),
    updatedAt: new Date(),
  }).where(and(eq(blocks.id, id), eq(blocks.organizationId, organizationId))).returning();

  if (input.component) {
    await db.insert(blockVersions).values({ blockId: id, versionNumber: nextVersion, document: input.component, createdBy: userId });
  }
  return row ?? null;
}

export async function getBlockWithVersions(organizationId: string, id: string) {
  const block = await getBlock(organizationId, id);
  if (!block) return null;
  const rows = await db.select().from(blockVersions).where(eq(blockVersions.blockId, id)).orderBy(desc(blockVersions.versionNumber));
  const versions = rows.map(v => ({ version: v.versionNumber, component: v.document, createdAt: v.createdAt }));
  return { ...block, component: block.currentDocument, version: versions[0]?.version ?? 1, versions };
}

export async function getBlockVersion(organizationId: string, id: string, version: number) {
  const current = await getBlock(organizationId, id);
  if (!current) return null;
  const [row] = await db.select().from(blockVersions).where(and(eq(blockVersions.blockId, id), eq(blockVersions.versionNumber, version)));
  return row ? { version: row.versionNumber, component: row.document, createdAt: row.createdAt } : null;
}

export async function deleteBlock(organizationId: string, id: string) {
  const deleted = await db.delete(blocks).where(and(eq(blocks.id, id), eq(blocks.organizationId, organizationId))).returning({ id: blocks.id });
  return deleted.length > 0;
}
