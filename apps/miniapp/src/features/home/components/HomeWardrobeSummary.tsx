import { useEffect, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import type { ClothingItem, GenerationJob } from '@lumi/contracts';
import { hasSession, getSessionEpoch } from '../../../services/http-client';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { AppIcon } from '../../../components/ui/AppIcon/AppIcon';
import { PrivateMediaImage } from '../../media/components/PrivateMediaImage';
import { listClothingPage } from '../../wardrobe/wardrobe.api';
import { listGenerations } from '../../generations/generations.api';
import './HomeWardrobeSummary.scss';

export function HomeWardrobeSummary() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [recent, setRecent] = useState<GenerationJob>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const account = useRef(getSessionEpoch());
  const load = async () => {
    const request = ++sequence.current;
    const epoch = getSessionEpoch();
    if (account.current !== epoch || !hasSession()) {
      setItems([]);
      setRecent(undefined);
      setError(false);
      account.current = epoch;
    }
    if (!hasSession()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    const [wardrobe, history] = await Promise.allSettled([listClothingPage(), listGenerations()]);
    if (request !== sequence.current || epoch !== getSessionEpoch()) return;
    if (wardrobe.status === 'fulfilled') setItems(wardrobe.value.items.slice(0, 3));
    if (history.status === 'fulfilled') {
      setRecent(
        history.value.items.find(
          (job) =>
            job.status === 'QUEUED' ||
            job.status === 'RUNNING' ||
            (job.status === 'SUCCEEDED' && job.outputs.length > 0 && !job.outputs.some((output) => output.selectedAt)),
        ),
      );
    }
    setError(wardrobe.status === 'rejected' || history.status === 'rejected');
    setLoading(false);
  };
  useDidShow(() => {
    void load();
  });
  useDidHide(() => {
    sequence.current += 1;
  });
  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );
  if (!items.length && !recent && !error) return null;
  return (
    <View className="home-assets">
      {recent && (
        <View
          className="home-resume"
          role="button"
          onClick={() => void Taro.navigateTo({ url: `/pages/generations/index?id=${encodeURIComponent(recent.id)}` })}
        >
          <AppIcon name="clock" active />
          <View className="home-resume-copy">
            <Text className="home-resume-title">
              {recent.status === 'SUCCEEDED' ? '有一套试穿，等你确认' : '你的试穿还在处理中'}
            </Text>
            <Text className="section-caption">继续上次任务 · 仅自己可见</Text>
          </View>
          <AppIcon name="chevron-right" />
        </View>
      )}
      {!!items.length && (
        <>
          <View className="home-assets-heading">
            <Text className="section-title">你的衣橱</Text>
            <AppButton
              compact
              variant="secondary"
              onClick={() => void Taro.switchTab({ url: '/pages/wardrobe/index' })}
            >
              查看全部
            </AppButton>
          </View>
          <View className="home-assets-grid">
            {items.map((item) => (
              <View key={item.id} className="home-asset">
                {item.assetId ? (
                  <PrivateMediaImage assetId={item.assetId} className="home-asset-image" mode="aspectFit" />
                ) : (
                  <View className="home-asset-image home-asset-missing">
                    <AppIcon name="shirt" />
                    <Text>待添加图片</Text>
                  </View>
                )}
                <Text className="home-asset-name">{item.name}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {error && (
        <View className="home-assets-error">
          <Text>个人资料暂未完整读取，公开穿搭仍可浏览。</Text>
          <AppButton compact variant="secondary" loading={loading} onClick={() => void load()}>
            重试
          </AppButton>
        </View>
      )}
    </View>
  );
}
