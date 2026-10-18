import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { api, type GenerationJob } from '../../services/api';
import './index.scss';

const highlights = [
  { title: '今日灵感', body: '从一件衣物开始，看看它适合你的样子。' },
  { title: '静态试穿', body: '上传人物照和衣物照，生成你的穿搭参考。' },
];

export default function Index() {
  const [active, setActive] = useState('推荐');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const startTryOn = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('正在连接 Lumi…');
    try {
      await api.login();
      const profiles = await api.listProfiles();
      const profile = profiles[0] ?? (await api.createProfile({ name: '我的默认档案', heightCm: 165, weightKg: 52 }));
      const profileVersionId = profiles[0]?.versions[0]?.id ?? profile.id;
      const clothing = (await api.listClothing())[0] ?? (await api.createClothing({ name: '日常上装', category: 'TOP' }));
      const job = await api.createGeneration({
        profileVersionId,
        clothingAssetId: clothing.id,
        idempotencyKey: `demo-${Date.now()}`,
      });
      let latest: GenerationJob = job;
      for (let attempt = 0; attempt < 6 && (latest.status === 'QUEUED' || latest.status === 'RUNNING'); attempt += 1) {
        setStatus(attempt === 0 ? '任务已创建，正在生成…' : `生成中（${attempt}/5）…`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        latest = await api.getGeneration(job.id);
      }
      setStatus(latest.status === 'SUCCEEDED' ? '试穿完成，结果已保存到生成记录。' : `任务状态：${latest.status}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '暂时无法完成试穿，请稍后重试');
      Taro.showToast({ title: '试穿失败', icon: 'none' });
    } finally {
      setBusy(false);
    }
  };

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
          <Button className="primary-button" loading={busy} disabled={busy} onClick={startTryOn}>
            {busy ? '生成中' : '开始免费试穿'}
          </Button>
          {status && <Text className="status-copy">{status}</Text>}
        </View>
      )}

      {active === '我的' && (
        <View className="empty-state">
          <Text className="empty-title">登录后管理你的资料</Text>
          <Text className="empty-copy">你的身材档案、衣物和生成结果都会保存在这里。</Text>
          <Button className="primary-button" onClick={() => setActive('试穿')}>开始使用</Button>
        </View>
      )}
    </View>
  );
}
