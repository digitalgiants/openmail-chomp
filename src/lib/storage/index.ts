import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";
import { R2StorageProvider } from "./r2";

let provider: StorageProvider | undefined;
export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = process.env.STORAGE_PROVIDER === "r2" ? new R2StorageProvider() : new LocalStorageProvider();
  }
  return provider;
}
export function getLocalStorageProvider() {
  return new LocalStorageProvider();
}
