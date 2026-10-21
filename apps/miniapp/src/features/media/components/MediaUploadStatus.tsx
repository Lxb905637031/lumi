import { Progress, Text, View } from '@tarojs/components';
import type { MediaUploadProgress } from '../media.api';

export function MediaUploadStatus({ progress }: { progress?: MediaUploadProgress }) {
  if (!progress) return null;
  return (
    <View className="media-upload-status" aria-live="polite">
      <View className="media-upload-status-heading">
        <Text>{progress.phase === 'uploading' ? '正在上传图片' : '图片已上传，正在安全处理'}</Text>
        {progress.phase === 'uploading' && <Text>{progress.percent ?? 0}%</Text>}
      </View>
      {progress.phase === 'uploading' && <Progress percent={progress.percent ?? 0} showInfo={false} />}
    </View>
  );
}
