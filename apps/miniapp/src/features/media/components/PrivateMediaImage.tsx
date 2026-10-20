import { useEffect, useRef, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import { getSessionEpoch } from '../../../services/http-client';
import { getMediaAsset } from '../media.api';
import './PrivateMediaImage.scss';

/** Short-lived authorized URLs stay in memory; an expired/failed read is explicitly refreshed. */
type PrivateMediaImageProps = {
  assetId: string;
  className?: string;
  mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix';
};

export function PrivateMediaImage({
  assetId,
  className = 'try-on-result-image',
  mode = 'aspectFit',
}: PrivateMediaImageProps) {
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
    <View className={`${className} private-media-frame`}>
      {url && !error && (
        <Image
          className="private-media-image"
          src={url}
          mode={mode}
          onError={() => setError('图片加载失败或凭证已过期，可重新读取')}
        />
      )}
      {(!url || error) && (
        <View className="private-media-status" aria-busy={busy}>
          <Text>{busy ? '图片加载中' : '图片暂不可用'}</Text>
          {error && (
            <Button className="private-media-retry" disabled={busy} onClick={() => void load()} aria-label={error}>
              重新读取
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
