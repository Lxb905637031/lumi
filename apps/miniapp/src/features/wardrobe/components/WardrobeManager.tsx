import { useState } from 'react';
import { Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { ensureLogin } from '../../auth/auth.api';
import { uploadImage } from '../../media/media.api';
import { createClothingItem, deleteClothingItem, listClothingPage } from '../wardrobe.api';
import type { ClothingItem } from '@lumi/contracts';
import '../../profile/components/ProfilePanel.scss';

async function fetchWardrobe(cursor?: string) {
  await ensureLogin();
  return listClothingPage(cursor);
}

export function WardrobeManager() {
  const list = useCursorList(fetchWardrobe);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingItem['category']>('TOP');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await ensureLogin();
      const result = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const path = result.tempFilePaths[0];
      if (!path) return;
      const asset = await uploadImage(path);
      await createClothingItem({
        name: name.trim(),
        category,
        assetId: asset.id,
        color: color.trim() || undefined,
        style: style.trim() || undefined,
      });
      setName('');
      setColor('');
      setStyle('');
      await list.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请检查相册权限或网络');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    const confirmation = await Taro.showModal({
      title: '删除衣物？',
      content: '此衣物不再用于新试穿，历史任务仍保留。',
    });
    if (!confirmation.confirm) return;
    try {
      await deleteClothingItem(id);
      await list.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败');
    }
  };
  return (
    <View>
      <Text className="profile-section-title">我的衣橱</Text>
      <ResourceStatus
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        onRetry={() => void list.reload()}
      />
      {list.items.map((item) => (
        <View className="profile-record" key={item.id}>
          <View>
            <Text className="profile-record-title">{item.name}</Text>
            <Text className="profile-muted">
              {item.category} · {item.color || '未填写颜色'}
            </Text>
          </View>
          <AppButton variant="secondary" onClick={() => void remove(item.id)}>
            删除
          </AppButton>
        </View>
      ))}
      {list.hasMore && (
        <AppButton variant="secondary" onClick={() => void list.loadMore()}>
          更多单品
        </AppButton>
      )}
      <View className="profile-form profile-inline-form">
        <Input
          className="profile-input"
          value={name}
          onInput={(event) => setName(event.detail.value)}
          placeholder="衣物名称（必填）"
          maxlength={80}
        />
        <View className="profile-category-options">
          {(['TOP', 'BOTTOM', 'DRESS'] as const).map((value) => (
            <AppButton
              key={value}
              variant={category === value ? 'primary' : 'secondary'}
              onClick={() => setCategory(value)}
            >
              {value === 'TOP' ? '上装' : value === 'BOTTOM' ? '下装' : '连衣裙'}
            </AppButton>
          ))}
        </View>
        <Input
          className="profile-input"
          value={color}
          onInput={(event) => setColor(event.detail.value)}
          placeholder="颜色（可选）"
          maxlength={40}
        />
        <Input
          className="profile-input"
          value={style}
          onInput={(event) => setStyle(event.detail.value)}
          placeholder="风格（可选）"
          maxlength={80}
        />
        <Text className="profile-hint">选择正面平铺、背景干净的单件衣物图片，避免遮挡。保存衣物不会发起生成。</Text>
        {error && <InlineFeedback message={error} tone="error" />}
        <AppButton disabled={!name.trim()} loading={busy} onClick={() => void save()}>
          选择衣物图片并保存
        </AppButton>
      </View>
    </View>
  );
}
