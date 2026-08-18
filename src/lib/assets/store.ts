import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetRecord } from "./types";

const file = path.join(process.cwd(), "data", "assets.json");
async function readAll(): Promise<AssetRecord[]> {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return []; }
}
async function writeAll(items: AssetRecord[]) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(items, null, 2));
}
export async function listAssets() { return readAll(); }
export async function createAsset(asset: AssetRecord) { const items = await readAll(); items.unshift(asset); await writeAll(items); return asset; }
export async function updateAsset(id: string, patch: Partial<AssetRecord>) { const items = await readAll(); const index = items.findIndex(a => a.id === id); if (index < 0) return null; items[index] = { ...items[index], ...patch }; await writeAll(items); return items[index]; }
export async function deleteAsset(id: string) { const items = await readAll(); await writeAll(items.filter(a => a.id !== id)); }
