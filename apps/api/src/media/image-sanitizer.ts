import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 16_000_000;

export async function sanitizeImage(bytes: Buffer, mimeType: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new BadRequestException('图片必须在 1B 至 5MiB 之间');
  const formats: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!formats[mimeType]) throw new BadRequestException('仅支持 JPEG、PNG 或 WebP');
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'warning', animated: false });
    const metadata = await image.metadata();
    if (metadata.format !== formats[mimeType] || (metadata.pages ?? 1) > 1) throw new Error('Invalid image type');
    const { data, info } = await image
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    if (data.byteLength > MAX_IMAGE_BYTES) throw new Error('Sanitized image too large');
    return { bytes: data, mimeType: 'image/webp' as const, width: info.width, height: info.height };
  } catch {
    throw new BadRequestException('图片无法完整解码、格式不符、包含多帧或像素超过限制');
  }
}
