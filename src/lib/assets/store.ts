import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assets } from "@/db/schema";

export interface CreateAssetInput {
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  storageProvider: string;
  storageKey: string;
  publicUrl: string;
  altText?: string;
  folderId?: string;
}

export const listAssets = (organizationId: string) =>
  db.select().from(assets).where(eq(assets.organizationId, organizationId)).orderBy(desc(assets.createdAt));

export async function createAsset(organizationId: string, userId: string, input: CreateAssetInput) {
  const [row] = await db.insert(assets).values({ organizationId, createdBy: userId, ...input }).returning();
  return row;
}

export async function updateAsset(organizationId: string, id: string, patch: Partial<CreateAssetInput>) {
  const [row] = await db.update(assets).set({ ...patch, updatedAt: new Date() }).where(and(eq(assets.id, id), eq(assets.organizationId, organizationId))).returning();
  return row ?? null;
}

export async function deleteAsset(organizationId: string, id: string) {
  const [deleted] = await db.delete(assets).where(and(eq(assets.id, id), eq(assets.organizationId, organizationId))).returning();
  return deleted ?? null;
}
