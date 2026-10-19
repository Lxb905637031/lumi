import { useEffect, useRef, useState } from 'react';
import { Image, View } from '@tarojs/components';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { getSessionEpoch } from '../../../services/http-client';
import { getMediaAsset } from '../media.api';

/** Short-lived authorized URLs stay in memory; an expired/failed read is explicitly refreshed. */
export function PrivateMediaImage({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const serial = useRef(0);
  const load = async () => {
    const version = ++serial.current;
    const epoch = getSessionEpoch();
    const valid = () => version === serial.current && epoch === getSessionEpoch();
    setBusy(true);
    setError(undefined);
    try {
      const asset = await getMediaAsset(assetId);
      if (!valid()) return;
      const location = asset.url ?? asset.previewData;
      if (!location) throw new Error('图片暂不可用');
      setUrl(location);
    } catch (reason) {
      if (valid()) setError(reason instanceof Error ? reason.message : '图片读取失败');
    } finally {
      if (valid()) setBusy(false);
    }
  };
  useEffect(() => {
    setUrl(undefined);
    void load();
    return () => {
      serial.current += 1;
    };
  }, [assetId]);
  return (
    <View>
      {url && !error && (
        <Image
          className="try-on-result-image"
          src={url}
          mode="aspectFit"
          onError={() => setError('图片加载失败或凭证已过期，可重新读取')}
        />
      )}
      {error && <InlineFeedback message={error} tone="error" />}
      {(!url || error) && (
        <AppButton variant="secondary" loading={busy} onClick={() => void load()}>
          重新读取私有图片
        </AppButton>
      )}
    </View>
  );
}
