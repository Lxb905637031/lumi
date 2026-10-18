import { Text, View } from '@tarojs/components';
import './HomeHeader.scss';

export function HomeHeader() {
  return (
    <View className="home-hero">
      <View>
        <Text className="home-eyebrow">LUMI / PERSONAL STYLE</Text>
        <Text className="home-title">穿上想象，先看见自己。</Text>
        <Text className="home-subtitle">建立你的身材档案，探索更适合你的穿搭。</Text>
      </View>
      <View className="home-mark">L</View>
    </View>
  );
}
