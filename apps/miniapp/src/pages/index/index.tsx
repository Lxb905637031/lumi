import { View, Text, Button } from '@tarojs/components';
import { useState } from 'react';
import './index.scss';

const highlights = [
  { title: '今日灵感', body: '从一件衣物开始，看看它适合你的样子。' },
  { title: '静态试穿', body: '上传人物照和衣物照，生成你的穿搭参考。' },
];

export default function Index() {
  const [active, setActive] = useState('推荐');

  return (
    <View className="page">
      <View className="hero">
        <View>
          <Text className="eyebrow">LUMI / PERSONAL STYLE</Text>
          <Text className="title">穿上想象，先看见自己。</Text>
          <Text className="subtitle">建立你的身材档案，探索更适合你的穿搭。</Text>
        </View>
        <View className="hero-mark">L</View>
      </View>

      <View className="tabs">
        {['推荐', '试穿', '我的'].map((tab) => (
          <Text
            key={tab}
            className={active === tab ? 'tab tab-active' : 'tab'}
            onClick={() => setActive(tab)}
          >
            {tab}
          </Text>
        ))}
      </View>

      {active === '推荐' && (
        <View className="grid">
          {highlights.map((item) => (
            <View className="inspiration" key={item.title}>
              <View className="image-placeholder">
                <Text>{item.title}</Text>
              </View>
              <Text className="card-title">{item.body}</Text>
              <Text className="card-meta">Lumi 编辑推荐</Text>
            </View>
          ))}
        </View>
      )}

      {active === '试穿' && (
        <View className="empty-state">
          <Text className="empty-title">开始你的第一次试穿</Text>
          <Text className="empty-copy">上传人物照和一件衣物，我们会生成一张静态参考图。</Text>
          <Button className="primary-button">创建身材档案</Button>
        </View>
      )}

      {active === '我的' && (
        <View className="empty-state">
          <Text className="empty-title">登录后管理你的资料</Text>
          <Text className="empty-copy">你的身材档案、衣物和生成结果都会保存在这里。</Text>
          <Button className="primary-button">微信登录</Button>
        </View>
      )}
    </View>
  );
}
