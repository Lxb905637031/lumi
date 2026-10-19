import type { PresignedPost } from '@aws-sdk/s3-presigned-post';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  createUpload(key: string, mimeType: string, byteSize: number, expiresIn: number): Promise<PresignedPost>;
  read(key: string, maxBytes: number): Promise<{ bytes: Buffer; mimeType: string | undefined }>;
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  delete(key: string): Promise<void>;
  signedRead(key: string, expiresIn: number): Promise<string>;
}
