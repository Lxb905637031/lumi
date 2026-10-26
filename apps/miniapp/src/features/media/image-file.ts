import type { CreateMediaAssetInput } from '@lumi/contracts';

const MIME_BY_EXTENSION: Record<string, CreateMediaAssetInput['mimeType']> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function imageMimeType(filePath: string): CreateMediaAssetInput['mimeType'] {
  const fileName = filePath.split('/').pop()?.split('?')[0] ?? '';
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined;
  const mimeType = extension ? MIME_BY_EXTENSION[extension] : undefined;
  if (!mimeType) throw new Error('仅支持 JPG、PNG 或 WebP 图片，请重新选择');
  return mimeType;
}
