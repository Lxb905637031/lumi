import { Image, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { useCursorList } from '../../../hooks/useCursorList';
import { ensureLogin } from '../../auth/auth.api';
import { archiveBodyProfile, listBodyProfilePage } from '../body-profiles.api';
import { measurementFields, useProfileEditor } from '../useProfileEditor';
import '../../profile/components/ProfilePanel.scss';

async function fetchProfiles(cursor?: string) {
  await ensureLogin();
  return listBodyProfilePage(cursor);
}

export function BodyProfileManager() {
  const list = useCursorList(fetchProfiles);
  const editor = useProfileEditor(list.reload);
  const archive = async (id: string) => {
    const confirmation = await Taro.showModal({
      title: '停用档案？',
      content: '历史结果仍保留原始版本，新试穿不能再使用此档案。',
    });
    if (!confirmation.confirm) return;
    try {
      await archiveBodyProfile(id);
      await list.reload();
    } catch (reason) {
      void Taro.showToast({ title: reason instanceof Error ? reason.message : '停用失败', icon: 'none' });
    }
  };
  return (
    <View>
      <View className="feature-page-heading">
        <Text className="feature-eyebrow">PRIVATE PROFILE</Text>
        <Text className="page-title">人物档案</Text>
        <Text className="page-description">保存你的照片和尺寸版本，只在你主动发起试穿时使用。</Text>
      </View>
      <View className="profile-section">
        <Text className="profile-hint">
          参数均可不填；照片建议使用光线均匀、无明显遮挡的正面全身照。生成效果不保证尺码合身。
        </Text>
      </View>
      <ResourceStatus
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        onRetry={() => void list.reload()}
      />
      {list.items.map((profile) => (
        <View className="profile-record" key={profile.id}>
          <View>
            <Text className="profile-record-title">{profile.name}</Text>
            <Text className="profile-muted">版本 {profile.activeVersion}</Text>
          </View>
          <View className="profile-record-actions">
            <AppButton variant="secondary" onClick={() => editor.edit(profile)}>
              编辑
            </AppButton>
            <AppButton variant="secondary" onClick={() => void archive(profile.id)}>
              停用
            </AppButton>
          </View>
        </View>
      ))}
      {list.hasMore && (
        <AppButton variant="secondary" onClick={() => void list.loadMore()}>
          更多档案
        </AppButton>
      )}
      <View className="profile-form">
        <Text className="profile-section-title">{editor.editing ? '保存新版本' : '创建档案'}</Text>
        <Input
          className="profile-input"
          value={editor.form.name}
          onInput={(event) => editor.setField('name', event.detail.value)}
          placeholder="档案名称"
          maxlength={80}
        />
        <View className="profile-measurements">
          {measurementFields.map(([key, label, guide]) => (
            <View key={key}>
              <Text className="profile-muted">{label}（可选）</Text>
              <Input
                className="profile-input"
                type="number"
                value={editor.form[key]}
                onInput={(event) => editor.setField(key, event.detail.value)}
                placeholder="暂不填写"
              />
              <Text className="profile-hint">{guide}</Text>
            </View>
          ))}
        </View>
        {editor.preview && <Image className="profile-person-preview" src={editor.preview} mode="aspectFit" />}
        {editor.assetId && <Text className="profile-muted">已关联人物图片</Text>}
        {editor.error && <InlineFeedback message={editor.error} tone="error" />}
        <AppButton variant="secondary" disabled={editor.busy} onClick={() => void editor.chooseImage()}>
          上传人物照
        </AppButton>
        <AppButton loading={editor.busy} onClick={() => void editor.save()}>
          保存资料，不发起生成
        </AppButton>
      </View>
    </View>
  );
}
