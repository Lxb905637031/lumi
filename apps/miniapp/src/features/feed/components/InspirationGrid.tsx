import { Text, View } from '@tarojs/components';
import './InspirationGrid.scss';

const highlights = [
  { title: '今日灵感', body: '从一件衣物开始，看看它适合你的样子。' },
  { title: '静态试穿', body: '上传人物照和衣物照，生成你的穿搭参考。' },
];

export function InspirationGrid() {
  return (
    <View className="inspiration-grid">
      {highlights.map((item) => (
        <View className="feed-inspiration" key={item.title}>
          <View className="feed-image-placeholder">
            <Text>{item.title}</Text>
          </View>
          <Text className="feed-card-title">{item.body}</Text>
          <Text className="feed-card-meta">Lumi 编辑推荐</Text>
        </View>
      ))}
    </View>
  );
}
