import { useMemo, useState } from 'react';
import { Image, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { ClothingItem, CreateClothingInput } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { ensureLogin } from '../../auth/auth.api';
import { PrivateMediaImage } from '../../media/components/PrivateMediaImage';
import { uploadImage } from '../../media/media.api';
import { createClothingItem, deleteClothingItem, listClothingPage, updateClothingItem } from '../wardrobe.api';
import './WardrobeManager.scss';

type ClothingCategory = ClothingItem['category'];
type CategoryFilter = 'ALL' | ClothingCategory;

const categories: { id: CategoryFilter; label: string }[] = [
  { id: 'ALL', label: '全部' },
  { id: 'TOP', label: '上装' },
  { id: 'BOTTOM', label: '下装' },
  { id: 'DRESS', label: '连衣裙' },
];

const categoryNames: Record<ClothingCategory, string> = {
  TOP: '上装',
  BOTTOM: '下装',
  DRESS: '连衣裙',
};

async function fetchWardrobe(cursor?: string) {
  await ensureLogin();
  return listClothingPage(cursor);
}

export function WardrobeManager() {
  const list = useCursorList(fetchWardrobe);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('TOP');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const isEditing = Boolean(editingId && editingId !== 'new');
  const visibleItems = useMemo(
    () => (categoryFilter === 'ALL' ? list.items : list.items.filter((item) => item.category === categoryFilter)),
    [categoryFilter, list.items],
  );

  const resetEditor = () => {
    setEditingId(undefined);
    setName('');
    setCategory('TOP');
    setColor('');
    setStyle('');
    setImagePath('');
    setError(undefined);
  };

  const edit = (item: ClothingItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setColor(item.color ?? '');
    setStyle(item.style ?? '');
    setImagePath('');
    setError(undefined);
  };

  const choosePhoto = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await ensureLogin();
      const result = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      setImagePath(result.tempFilePaths[0] ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '没有取得图片，请检查相册权限后重试');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('请填写衣物名称。');
      return;
    }
    if (!isEditing && !imagePath) {
      setError('请先选择这件衣物的照片。');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await ensureLogin();
      const asset = imagePath ? await uploadImage(imagePath) : undefined;
      const input: CreateClothingInput = {
        name: name.trim(),
        category,
        assetId: asset?.id,
        color: color.trim() || undefined,
        style: style.trim() || undefined,
      };
      if (isEditing && editingId) await updateClothingItem(editingId, input);
      else await createClothingItem(input);
      resetEditor();
      await list.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请检查图片权限或网络后重试');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const confirmation = await Taro.showModal({
      title: '删除这件衣物？',
      content: '它将不能用于新的试穿，历史任务仍保留原始记录。',
      confirmText: '删除衣物',
    });
    if (!confirmation.confirm) return;
    setError(undefined);
    try {
      await deleteClothingItem(id);
      if (editingId === id) resetEditor();
      await list.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败，请重新读取衣橱后再试');
    }
  };

  return (
    <View className="wardrobe-workspace">
      <View className="wardrobe-overview">
        <View>
          <Text className="wardrobe-overview-count">{list.items.length}</Text>
          <Text className="wardrobe-overview-label">已加载单品</Text>
        </View>
        <AppButton onClick={() => (editingId ? resetEditor() : setEditingId('new'))}>
          {editingId ? '取消编辑' : '添加衣物'}
        </AppButton>
      </View>

      {editingId !== undefined && (
        <View className="wardrobe-editor surface page-section">
          <View className="wardrobe-editor-heading">
            <View>
              <Text className="section-title">{isEditing ? '编辑单品' : '添加一件衣物'}</Text>
              <Text className="section-caption">单件、正面、背景清楚，之后可以重复用于试穿。</Text>
            </View>
          </View>
          {imagePath ? (
            <Image className="wardrobe-editor-image" src={imagePath} mode="aspectFill" />
          ) : isEditing && editingId && list.items.find((item) => item.id === editingId)?.assetId ? (
            <PrivateMediaImage
              assetId={list.items.find((item) => item.id === editingId)!.assetId!}
              className="wardrobe-editor-image"
              mode="aspectFill"
            />
          ) : (
            <View className="wardrobe-photo-empty">
              <Text>选择衣物照片</Text>
              <Text className="section-caption">只用于你的私有衣橱</Text>
            </View>
          )}
          <AppButton variant="secondary" disabled={busy} onClick={() => void choosePhoto()}>
            {imagePath ? '更换照片' : isEditing ? '更换衣物照片' : '从相册或相机选择照片'}
          </AppButton>
          <View className="wardrobe-form-fields">
            <Text className="profile-muted">名称</Text>
            <Input
              className="profile-input"
              value={name}
              onInput={(event) => setName(event.detail.value)}
              placeholder="例如：浅蓝棉质衬衫"
              maxlength={80}
            />
            <Text className="profile-muted">品类</Text>
            <View className="wardrobe-categories wardrobe-categories--form">
              {categories
                .filter(({ id }) => id !== 'ALL')
                .map(({ id, label }) => (
                  <View
                    key={id}
                    className={category === id ? 'wardrobe-category is-selected' : 'wardrobe-category'}
                    role="button"
                    aria-pressed={category === id}
                    onClick={() => setCategory(id as ClothingCategory)}
                  >
                    {label}
                  </View>
                ))}
            </View>
            <View className="wardrobe-form-grid">
              <View>
                <Text className="profile-muted">颜色（选填）</Text>
                <Input
                  className="profile-input"
                  value={color}
                  onInput={(event) => setColor(event.detail.value)}
                  placeholder="浅蓝"
                  maxlength={40}
                />
              </View>
              <View>
                <Text className="profile-muted">风格（选填）</Text>
                <Input
                  className="profile-input"
                  value={style}
                  onInput={(event) => setStyle(event.detail.value)}
                  placeholder="日常 / 通勤"
                  maxlength={80}
                />
              </View>
            </View>
          </View>
          <Text className="wardrobe-privacy-note">私有照片不会公开。保存衣物不会启动生成，也不消耗试穿次数。</Text>
          {error && <InlineFeedback message={error} tone="error" />}
          <AppButton loading={busy} onClick={() => void save()}>
            {isEditing ? '保存单品修改' : '保存到我的衣橱'}
          </AppButton>
        </View>
      )}

      <View className="wardrobe-category-bar">
        {categories.map(({ id, label }) => (
          <View
            key={id}
            className={categoryFilter === id ? 'wardrobe-filter is-selected' : 'wardrobe-filter'}
            role="button"
            aria-pressed={categoryFilter === id}
            onClick={() => setCategoryFilter(id)}
          >
            {label}
          </View>
        ))}
      </View>

      {error && editingId === undefined && <InlineFeedback message={error} tone="error" />}
      <ResourceStatus
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        onRetry={() => void list.reload()}
      />
      {!list.loading && !list.error && list.items.length > 0 && visibleItems.length === 0 && (
        <View className="wardrobe-filter-empty">
          <Text>这个分类里还没有单品。</Text>
        </View>
      )}
      <View className="wardrobe-grid">
        {visibleItems.map((item) => (
          <View className="wardrobe-item" key={item.id}>
            {item.assetId ? (
              <PrivateMediaImage assetId={item.assetId} className="wardrobe-item-image" mode="aspectFill" />
            ) : (
              <View className="wardrobe-item-image wardrobe-item-image--missing">
                <Text>尚未上传照片</Text>
              </View>
            )}
            <View className="wardrobe-item-info">
              <Text className="wardrobe-item-name">{item.name}</Text>
              <Text className="wardrobe-item-meta">
                {categoryNames[item.category]}
                {item.color ? ` · ${item.color}` : ''}
              </Text>
              {item.style && <Text className="wardrobe-item-meta">{item.style}</Text>}
              <View className="wardrobe-item-actions">
                <View className="wardrobe-item-action">
                  <AppButton variant="secondary" onClick={() => edit(item)}>
                    编辑
                  </AppButton>
                </View>
                <View className="wardrobe-item-action">
                  <AppButton variant="secondary" onClick={() => void remove(item.id)}>
                    删除
                  </AppButton>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
      {list.hasMore && (
        <AppButton variant="secondary" loading={list.loading} onClick={() => void list.loadMore()}>
          加载更多衣物
        </AppButton>
      )}
    </View>
  );
}
