import type { CreateMediaAssetInput, MediaAsset } from '@lumi/contracts';
import Taro from '@tarojs/taro';
import { request } from '../../services/http-client';

export async function uploadImage(filePath: string): Promise<MediaAsset> {
  const base64 = await new Promise<string>((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (result) => resolve(result.data as string),
      fail: reject,
    });
  });
  const extension = filePath.split('.').pop()?.toLowerCase();
  const mimeType: CreateMediaAssetInput['mimeType'] =
    extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  return request<MediaAsset>('/media/assets', {
    method: 'POST',
    data: { fileName: filePath.split('/').pop() ?? 'upload.jpg', mimeType, base64 },
  });
}
