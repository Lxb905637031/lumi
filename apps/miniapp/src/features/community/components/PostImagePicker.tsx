import { Image, Text, View } from '@tarojs/components';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import type { DraftAsset } from '../post-composer-workflow';

export function PostImagePicker({
  assets,
  disabled,
  source,
  remaining,
  onRemove,
  onAdd,
}: {
  assets: DraftAsset[];
  disabled: boolean;
  source: boolean;
  remaining: number;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <View className="feed-image-list">
        {assets.map((asset) => (
          <Image
            key={asset.id}
            className="feed-upload-preview"
            src={asset.preview}
            mode="aspectFill"
            onClick={() => {
              if (!disabled && !source) onRemove(asset.id);
            }}
          />
        ))}
      </View>
      <Text className="feed-caption">
        {source ? '已确认的生成结果，自动标记 AI/开发生成内容。' : '1–9 张图片，点击已选图片可移除。'}
        审核通过后公开，不公开身体参数。
      </Text>
      {!source && (
        <AppButton block variant="secondary" disabled={disabled || assets.length >= 9} onClick={onAdd}>
          {remaining ? `重试剩余 ${remaining} 张上传` : '添加图片'}
        </AppButton>
      )}
    </>
  );
}
