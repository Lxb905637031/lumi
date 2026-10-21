import { Picker, Text, View } from '@tarojs/components';
import type { TryOnSnapshot, TryOnWorkflow } from '../try-on-workflow';
import { isActiveJob } from '../try-on-workflow';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { PrivateMediaImage } from '../../media/components/PrivateMediaImage';
import { AppIcon } from '../../../components/ui/AppIcon/AppIcon';

export function TryOnInputPicker({ state, workflow }: { state: TryOnSnapshot; workflow: TryOnWorkflow }) {
  const locked = state.busy || !!state.pendingInput || isActiveJob(state.job);
  const profiles = state.profiles.flatMap((profile) =>
    profile.versions.map((version) => ({
      id: version.id,
      version,
      name: profile.name + ' · v' + version.version + (version.sourceAssetId ? '' : '（缺少人物照）'),
    })),
  );
  const profileIndex = profiles.findIndex((p) => p.id === state.profileVersionId) + 1;
  const clothingIndex = state.clothing.findIndex((c) => c.id === state.clothingId) + 1;
  const version = profiles[profileIndex - 1]?.version;
  return (
    <View className="try-on-inputs">
      <View className="try-on-step">
        <Text className="try-on-step-number">1</Text>
        <Text>选择人物版本</Text>
      </View>
      <Picker
        disabled={locked}
        mode="selector"
        range={['请选择人物版本', ...profiles.map((p) => p.name)]}
        value={profileIndex}
        onChange={(event) => {
          const option = profiles[Number(event.detail.value) - 1];
          if (option) workflow.selectProfile(option.id);
        }}
      >
        <View className="try-on-person">
          <AppIcon name="user-round" active />
          <View className="try-on-person-copy">
            <Text>{profiles[profileIndex - 1]?.name ?? '选择人物档案'}</Text>
            <Text className="section-caption">照片与参数仅用于本次试穿</Text>
          </View>
          <AppIcon name="chevron-right" />
        </View>
      </Picker>
      {version?.sourceAssetId && (
        <PrivateMediaImage assetId={version.sourceAssetId} className="try-on-person-image" mode="aspectFit" />
      )}
      {version && (
        <Text className="profile-hint">
          身高 {version.measurements.heightCm ?? '未填'} cm · 体重 {version.measurements.weightKg ?? '未填'}{' '}
          kg；使用此版本保存的参数，不自动改用其他档案。
        </Text>
      )}
      {!profiles.length && <Text className="profile-hint">还没有可用人物档案，请先添加人物照和资料。</Text>}
      {state.profileCursor && (
        <AppButton compact variant="secondary" disabled={locked} onClick={() => void workflow.more('profiles')}>
          更多人物档案
        </AppButton>
      )}
      {profileIndex > 0 &&
        (() => {
          const profile = state.profiles.find((item) =>
            item.versions.some((itemVersion) => itemVersion.id === state.profileVersionId),
          );
          if (!profile || profile.versions.length >= profile.activeVersion) return null;
          return (
            <AppButton compact variant="secondary" disabled={locked} onClick={() => void workflow.loadProfileHistory()}>
              {state.busy ? '加载中' : state.profileHistoryCursor ? '更多历史版本' : '加载历史版本'}
            </AppButton>
          );
        })()}
      <View className="try-on-step">
        <Text className="try-on-step-number">2</Text>
        <Text>选择一件衣物</Text>
        <Text className="section-caption">{clothingIndex > 0 ? '已选 1 件' : '尚未选择'}</Text>
      </View>
      <View className="try-on-clothing-grid">
        {state.clothing.map((item) => (
          <View key={item.id} className={`try-on-clothing ${state.clothingId === item.id ? 'is-selected' : ''}`}>
            {item.assetId ? (
              <PrivateMediaImage assetId={item.assetId} className="try-on-clothing-image" mode="aspectFit" />
            ) : (
              <View className="try-on-clothing-image try-on-clothing-missing">
                <AppIcon name="shirt" />
                <Text>待补充图片</Text>
              </View>
            )}
            <Text className="try-on-clothing-name">{item.name}</Text>
            <AppButton
              block
              compact
              variant={state.clothingId === item.id ? 'primary' : 'secondary'}
              disabled={locked || !item.assetId}
              onClick={() => workflow.selectClothing(item.id)}
            >
              {state.clothingId === item.id ? '已选择' : '选这件'}
            </AppButton>
          </View>
        ))}
      </View>
      {!state.clothing.length && <Text className="profile-hint">还没有衣橱单品，请先上传一件衣物图片。</Text>}
      {state.clothingCursor && (
        <AppButton compact variant="secondary" disabled={locked} onClick={() => void workflow.more('clothing')}>
          更多衣物
        </AppButton>
      )}
      {locked && <Text className="profile-hint">任务或提交结果尚未结束，输入已锁定。请继续查询或取消原任务。</Text>}
    </View>
  );
}
