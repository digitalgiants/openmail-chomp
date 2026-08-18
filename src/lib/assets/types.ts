export type AssetRecord = {
  id: string;
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
  createdAt: string;
};
