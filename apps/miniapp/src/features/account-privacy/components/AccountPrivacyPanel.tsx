import { useEffect, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { AccountDeletionRequest, DataExportRequest } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { hasSession } from '../../../services/http-client';
import {
  cancelDeletionRequest,
  createDataExport,
  createDeletionRequest,
  downloadDataExport,
  getDeletionRequest,
  listDataExports,
} from '../account-privacy.api';
import './AccountPrivacyPanel.scss';

const deletionStatus: Record<AccountDeletionRequest['status'], string> = {
  REQUESTED: '已申请，仍可撤回',
  PROCESSING: '正在清理数据，无法撤回',
  COMPLETED: '已完成注销',
  CANCELLED: '已撤回',
  FAILED: '处理失败，系统将自动重试',
};

const exportStatus: Record<DataExportRequest['status'], string> = {
  REQUESTED: '排队中',
  PROCESSING: '生成中',
  READY: '可下载',
  EXPIRED: '已过期',
  FAILED: '生成失败',
};

export function AccountPrivacyPanel() {
  const [deletion, setDeletion] = useState<AccountDeletionRequest | null>();
  const [exports, setExports] = useState<DataExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pollTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = async () => {
    if (!hasSession()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [currentDeletion, exportPage] = await Promise.all([getDeletionRequest(), listDataExports()]);
      setDeletion(currentDeletion ?? null);
      setExports(exportPage.items);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '隐私数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!exports.some((item) => item.status === 'REQUESTED' || item.status === 'PROCESSING')) return;
    pollTimer.current = setTimeout(() => void load(), 2_000);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [exports]);

  const exportData = async () => {
    setBusy(true);
    try {
      await createDataExport();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导出申请失败');
    } finally {
      setBusy(false);
    }
  };

  const openExport = async (item: DataExportRequest) => {
    if (item.status !== 'READY') return;
    setBusy(true);
    try {
      const result = await downloadDataExport(item.id);
      await Taro.showModal({
        title: '数据导出已准备',
        content: `已包含 ${Object.keys(result.data).length} 类账号数据。请在有效期内联系 Lumi 支持获取文件。`,
        showCancel: false,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导出下载失败');
    } finally {
      setBusy(false);
    }
  };

  const requestAccountDeletion = async () => {
    const confirmation = await Taro.showModal({
      title: '确认注销账号',
      content: '注销将在宽限期后清理人物照片、衣橱、试穿结果、帖子、消息和关注关系。申请后仍可撤回。',
      confirmText: '申请注销',
      confirmColor: '#9b3e32',
    });
    if (!confirmation.confirm) return;
    setBusy(true);
    try {
      setDeletion(await createDeletionRequest());
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '注销申请失败');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      setDeletion(await cancelDeletionRequest());
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '撤回注销失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="privacy-workspace">
      <Text className="feature-eyebrow">ACCOUNT CONTROL</Text>
      <Text className="privacy-title">账号与隐私</Text>
      <Text className="privacy-copy">管理数据导出和账号注销。私有照片默认不公开，导出文件只对当前账号可见。</Text>
      {error && <InlineFeedback message={error} tone="error" />}
      <ResourceStatus loading={loading} error={undefined} empty={!hasSession()} onRetry={() => void load()} />
      {hasSession() && !loading && (
        <>
          <View className="privacy-section">
            <Text className="privacy-section-title">导出我的数据</Text>
            <Text className="privacy-hint">
              包括档案、衣橱、试穿任务、社区内容、关注关系和消息元数据，不包含私有对象原图。
            </Text>
            <AppButton block loading={busy} onClick={() => void exportData()}>
              申请数据导出
            </AppButton>
            {exports.map((item) => (
              <View className="privacy-record" key={item.id}>
                <View>
                  <Text className="privacy-record-title">{exportStatus[item.status]}</Text>
                  <Text className="privacy-hint">申请于 {new Date(item.requestedAt).toLocaleString('zh-CN')}</Text>
                </View>
                <AppButton
                  compact
                  variant="secondary"
                  disabled={item.status !== 'READY'}
                  loading={busy}
                  onClick={() => void openExport(item)}
                >
                  查看
                </AppButton>
              </View>
            ))}
          </View>
          <View className="privacy-section privacy-section--danger">
            <Text className="privacy-section-title">注销账号</Text>
            <Text className="privacy-hint">
              注销会清理账号下的个人资料和衍生数据，并登记对象存储清理任务。公开内容按隐私策略一并删除。
            </Text>
            {deletion && <Text className="privacy-state">当前状态：{deletionStatus[deletion.status]}</Text>}
            {deletion?.status === 'REQUESTED' ? (
              <AppButton block variant="secondary" loading={busy} onClick={() => void cancel()}>
                撤回注销申请
              </AppButton>
            ) : (
              <AppButton
                block
                variant="secondary"
                loading={busy}
                disabled={deletion?.status === 'PROCESSING' || deletion?.status === 'COMPLETED'}
                onClick={() => void requestAccountDeletion()}
              >
                申请注销账号
              </AppButton>
            )}
          </View>
        </>
      )}
    </View>
  );
}
