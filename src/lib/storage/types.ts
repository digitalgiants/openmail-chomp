export type StoredObject = { key: string; url?: string; size?: number; contentType?: string };
export interface StorageProvider {
  upload(input: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getUrl(key: string): Promise<string>;
}
