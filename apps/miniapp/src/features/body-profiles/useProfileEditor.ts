import { useState } from 'react';
import Taro from '@tarojs/taro';
import type { BodyProfile } from '@lumi/contracts';
import { createBodyProfile, updateBodyProfile } from './body-profiles.api';
import { uploadImage } from '../media/media.api';

export const measurementFields = [
  ['heightCm', '身高 cm', '赤脚站直，从头顶量到地面'],
  ['weightKg', '体重 kg', '轻装称重'],
  ['shoulderCm', '肩宽 cm', '两侧肩峰之间的距离'],
  ['bustCm', '胸围 cm', '软尺绕胸部最丰满处一周'],
  ['waistCm', '腰围 cm', '自然站立，绕腰部最细处一周'],
  ['hipCm', '臀围 cm', '绕臀部最丰满处一周'],
] as const;
type MeasurementKey = (typeof measurementFields)[number][0];
export type ProfileForm = { name: string } & Record<MeasurementKey, string>;
const emptyForm: ProfileForm = {
  name: '我的档案',
  heightCm: '',
  weightKg: '',
  shoulderCm: '',
  bustCm: '',
  waistCm: '',
  hipCm: '',
};

export function useProfileEditor(onSaved: () => Promise<void>) {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<BodyProfile>();
  const [assetId, setAssetId] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const setField = (key: keyof ProfileForm, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const edit = (profile: BodyProfile) => {
    setEditing(profile);
    setAssetId(profile.versions[0]?.sourceAssetId ?? undefined);
    setPreview(undefined);
    const measurements = profile.versions[0]?.measurements;
    setForm({
      name: profile.name,
      heightCm: String(measurements?.heightCm ?? ''),
      weightKg: String(measurements?.weightKg ?? ''),
      shoulderCm: String(measurements?.shoulderCm ?? ''),
      bustCm: String(measurements?.bustCm ?? ''),
      waistCm: String(measurements?.waistCm ?? ''),
      hipCm: String(measurements?.hipCm ?? ''),
    });
  };
  const chooseImage = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const path = result.tempFilePaths[0];
      if (path) {
        const asset = await uploadImage(path);
        setAssetId(asset.id);
        setPreview(path);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '图片上传失败，请检查相册权限并重试');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const measurements = Object.fromEntries(
        measurementFields.filter(([key]) => form[key] !== '').map(([key]) => [key, Number(form[key])]),
      );
      const input = { name: form.name.trim() || '我的档案', ...measurements, sourceAssetId: assetId };
      if (editing) await updateBodyProfile(editing.id, { ...input, expectedVersion: editing.activeVersion });
      else await createBodyProfile(input);
      setEditing(undefined);
      setForm(emptyForm);
      setAssetId(undefined);
      setPreview(undefined);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，输入已保留');
    } finally {
      setBusy(false);
    }
  };
  return { form, editing, preview, assetId, busy, error, setField, edit, chooseImage, save };
}
