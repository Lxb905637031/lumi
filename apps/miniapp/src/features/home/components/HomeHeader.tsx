import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { HomeTab } from '../home.types';
import { AppIcon } from '../../../components/ui/AppIcon/AppIcon';
import './HomeHeader.scss';

const copy: Record<HomeTab, { title: string; subtitle: string }> = {
  发现: { title: '今天，怎么穿？', subtitle: '从你的衣橱里，找到一点新灵感。' },
  衣橱: { title: '我的衣橱', subtitle: '把喜欢的单品收好，再多穿几次。' },
  试穿: { title: '试穿工作台', subtitle: '选择人物资料和一件衣物，先审阅再开始。' },
  我的: { title: '我的 Lumi', subtitle: '管理私有资料、试穿结果和社区内容。' },
};

export function HomeHeader({ activeTab }: { activeTab: HomeTab }) {
  return (
    <View className="home-header">
      <View className="home-header-brand">
        <Text className="home-wordmark">lumi</Text>
        <Text className="home-brand-divider">/</Text>
        <Text className="home-brand-label">我的日常衣橱</Text>
      </View>
      <View className="home-header-content">
        <View>
          <Text className="home-title">{copy[activeTab].title}</Text>
          <Text className="home-subtitle">{copy[activeTab].subtitle}</Text>
        </View>
        <View
          className="home-message-action"
          role="button"
          aria-label="查看消息"
          onClick={() => void Taro.navigateTo({ url: '/pages/messages/index' })}
        >
          <AppIcon name="bell" />
        </View>
      </View>
    </View>
  );
}
