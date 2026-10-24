import { Image, Text, View } from '@tarojs/components';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import type { GenerationShare } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { ResourceStatus } from '../../../components/ui/ResourceStatus/ResourceStatus';
import { getGenerationShare } from '../generation-sharing.api';
import './GenerationSharePage.scss';

export function GenerationSharePage({ token }: { token?: string }) {
  const [share, setShare] = useState<GenerationShare>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useShareAppMessage(() => ({
    title: 'Lumi 试穿结果',
    path: token ? `/pages/generation-share/index?token=${encodeURIComponent(token)}` : '/pages/index/index',
    ...(share?.url && share.url.startsWith('http') ? { imageUrl: share.url } : {}),
  }));

  const load = async () => {
    if (!token) {
      setError('分享链接不完整');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setShare(await getGenerationShare(token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '分享链接已失效');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const saveToAlbum = async () => {
    if (!share || busy) return;
    if (share.developmentPreview || share.url.startsWith('data:')) {
      await Taro.showModal({
        title: '开发预览不可保存',
        content: '当前链接来自本地 SVG 开发适配器，不是真实 AI 图片。接入生产模型和合法下载域名后，才支持保存到相册。',
        showCancel: false,
      });
      return;
    }
    setBusy(true);
    try {
      const downloaded = await Taro.downloadFile({ url: share.url });
      if (downloaded.statusCode !== 200) throw new Error('图片下载失败，请稍后重试');
      await Taro.saveImageToPhotosAlbum({ filePath: downloaded.tempFilePath });
      await Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (/auth|authorize|permission|denied|权限|授权/i.test(message)) {
        const choice = await Taro.showModal({ title: '需要相册权限', content: '请在设置中允许 Lumi 保存图片到相册。' });
        if (choice.confirm) await Taro.openSetting();
      } else {
        await Taro.showToast({ title: message || '保存失败', icon: 'none' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="page generation-share-page">
      <View className="feature-page-heading">
        <Text className="feature-eyebrow">LUMI SHARE</Text>
        <Text className="page-title">一套试穿结果</Text>
        <Text className="page-description">链接仅在短时间内有效，原始身体参数不会随分享公开。</Text>
      </View>
      <ResourceStatus loading={loading} error={error} onRetry={() => void load()} />
      {share && !loading && !error && (
        <>
          <View className="generation-share-image-wrap">
            <Image className="generation-share-image" src={share.url} mode="aspectFit" />
          </View>
          {share.developmentPreview && (
            <InlineFeedback message="这是 local-svg 开发预览，不代表真实 AI 试穿效果；当前仅用于联调分享链路。" />
          )}
          <AppButton block disabled={busy} onClick={() => void saveToAlbum()}>
            保存到手机相册
          </AppButton>
          <Text className="generation-share-caption">点击右上角“…”可转发给微信好友</Text>
        </>
      )}
    </View>
  );
}
