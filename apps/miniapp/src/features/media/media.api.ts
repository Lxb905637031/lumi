import type { MediaAsset, MediaUploadReservation, SystemBootstrap } from '@lumi/contracts';
import Taro from '@tarojs/taro';
import { getSessionEpoch, request } from '../../services/http-client';
import { imageMimeType } from './image-file';

const pendingUploads = new Map<string, { key: string; assetId?: string; uploaded: boolean; expiresAt: number }>();
export type MediaUploadProgress = { phase: 'uploading' | 'processing'; percent?: number };

export function getMediaAsset(id: string): Promise<MediaAsset> {
  return request(`/media/assets/${encodeURIComponent(id)}`);
}

export async function uploadImage(
  filePath: string,
  onProgress?: (progress: MediaUploadProgress) => void,
): Promise<MediaAsset> {
  const bootstrap = await request<SystemBootstrap>('/system/bootstrap');
  if (bootstrap.media.uploadMode === 'signed-post')
    return uploadPrivateImage(filePath, bootstrap.media.maxBytes, onProgress);
  if (!bootstrap.freeMode) throw new Error('图片上传尚未启用');
  const base64 = await new Promise<string>((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (result) => resolve(result.data as string),
      fail: reject,
    });
  });
  const mimeType = imageMimeType(filePath);
  return request<MediaAsset>('/media/assets', {
    method: 'POST',
    data: { fileName: filePath.split('/').pop() ?? 'upload.jpg', mimeType, base64 },
  });
}

async function uploadPrivateImage(
  filePath: string,
  maxBytes: number,
  onProgress?: (progress: MediaUploadProgress) => void,
): Promise<MediaAsset> {
  const file = await Taro.getFileInfo({ filePath });
  if (!('size' in file)) throw new Error('无法读取所选图片，请重新选择');
  const { size } = file;
  if (size < 1 || size > maxBytes) throw new Error('请选择不超过 5MiB 的图片');
  const mimeType = imageMimeType(filePath);
  const now = Date.now();
  for (const [path, value] of pendingUploads) if (value.expiresAt <= now) pendingUploads.delete(path);
  const cacheKey = `${getSessionEpoch()}:${filePath}`;
  let state = pendingUploads.get(cacheKey);
  if (!state) {
    state = { key: `upload-${now}-${Math.random().toString(36).slice(2)}`, uploaded: false, expiresAt: now + 240_000 };
    pendingUploads.set(cacheKey, state);
  }
  if (!state.uploaded) {
    const reservation = await request<MediaUploadReservation>('/media/assets/uploads', {
      method: 'POST',
      data: {
        fileName: filePath.split('/').pop() ?? 'upload.jpg',
        mimeType,
        byteSize: size,
        idempotencyKey: state.key,
      },
    });
    state.assetId = reservation.assetId;
    if (reservation.expiresAt) state.expiresAt = new Date(reservation.expiresAt).getTime();
    if (reservation.upload) {
      onProgress?.({ phase: 'uploading', percent: 0 });
      const task = Taro.uploadFile({
        url: reservation.upload.url,
        filePath,
        name: 'file',
        formData: reservation.upload.fields,
        timeout: 60_000,
      });
      task.onProgressUpdate(({ progress }) => onProgress?.({ phase: 'uploading', percent: progress }));
      const response = await task;
      if (response.statusCode !== 201) throw new Error('图片上传失败，请保留文件并重试');
    }
    state.uploaded = true;
  }
  onProgress?.({ phase: 'processing' });
  const asset = await request<MediaAsset>(`/media/assets/${state.assetId}/complete`, { method: 'POST' });
  if (asset.status !== 'READY') throw new Error('图片尚未处理完成，请重试');
  pendingUploads.delete(cacheKey);
  return asset;
}
