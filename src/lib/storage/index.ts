import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";

let provider: StorageProvider | undefined;
export function getStorageProvider(): StorageProvider {
  if (!provider) provider = new LocalStorageProvider();
  return provider;
}
export function getLocalStorageProvider() {
  return getStorageProvider() as LocalStorageProvider;
}
