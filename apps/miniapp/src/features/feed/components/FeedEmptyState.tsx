import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import './FeedEmptyState.scss';

export function FeedEmptyState() {
  return (
    <View className="feed-empty-state">
      <Text className="feed-empty-title">从自己的衣橱开始</Text>
      <Text className="feed-empty-description">这里还没有公开的穿搭。先收好喜欢的单品，试试下一套搭配。</Text>
      <View className="feed-empty-actions">
        <AppButton block onClick={() => void Taro.switchTab({ url: '/pages/wardrobe/index' })}>
          查看我的衣橱
        </AppButton>
        <AppButton block variant="secondary" onClick={() => void Taro.switchTab({ url: '/pages/try-on/index' })}>
          开始一次试穿
        </AppButton>
      </View>
      <Text className="feed-empty-note">公开穿搭审核后展示 · 你的原始照片默认私有</Text>
    </View>
  );
}
