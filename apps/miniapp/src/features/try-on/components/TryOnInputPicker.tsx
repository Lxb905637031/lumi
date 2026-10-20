import { Picker, Text, View } from '@tarojs/components';
import type { TryOnSnapshot, TryOnWorkflow } from '../try-on-workflow';
import { isActiveJob } from '../try-on-workflow';
import { AppButton } from '../../../components/ui/AppButton/AppButton';

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
    <View className="profile-form">
      <Text className="profile-section-title">确认生成输入</Text>
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
        <View className="profile-input">{profiles[profileIndex - 1]?.name ?? '请选择人物版本'}</View>
      </Picker>
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
      <Picker
        disabled={locked}
        mode="selector"
        range={[
          '请选择单件衣物',
          ...state.clothing.map((c) => c.name + ' · ' + c.category + (c.assetId ? '' : '（缺少图片）')),
        ]}
        value={clothingIndex}
        onChange={(event) => {
          const item = state.clothing[Number(event.detail.value) - 1];
          if (item) workflow.selectClothing(item.id);
        }}
      >
        <View className="profile-input">{state.clothing[clothingIndex - 1]?.name ?? '请选择单件衣物'}</View>
      </Picker>
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
