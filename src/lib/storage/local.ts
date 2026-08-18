import { mkdir, readFile, unlink, writeFile, access } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider, StoredObject } from "./types";

const root = path.join(process.cwd(), "data", "uploads");

function safePath(key: string) {
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid storage key");
  return resolved;
}

export class LocalStorageProvider implements StorageProvider {
  async upload(input: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<StoredObject> {
    const filePath = safePath(input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
    return { key: input.key, url: `/api/assets/file?key=${encodeURIComponent(input.key)}`, size: input.body.byteLength, contentType: input.contentType };
  }
  async delete(key: string) { await unlink(safePath(key)); }
  async exists(key: string) { try { await access(safePath(key)); return true; } catch { return false; } }
  async getUrl(key: string) { return `/api/assets/file?key=${encodeURIComponent(key)}`; }
  async read(key: string) { return readFile(safePath(key)); }
}
