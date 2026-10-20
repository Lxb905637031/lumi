export type AnalyticsEventMap = {
  'app.opened': { entry: 'tab' | 'notification' | 'share' };
  'profile.created': { hasPhoto: boolean; measurementCount: number };
  'wardrobe.item_created': { category: 'TOP' | 'BOTTOM' | 'DRESS' };
  'try_on.started': { profileVersion: number; category: 'TOP' | 'BOTTOM' | 'DRESS' };
  'try_on.completed': { durationBucket: 'under_30s' | '30s_to_2m' | 'over_2m' };
  'try_on.failed': { reason: 'network' | 'quota' | 'provider' | 'unknown' };
  'community.post_published': { imageCount: number; isAiGenerated: boolean };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsEvent = {
  [Name in AnalyticsEventName]: {
    name: Name;
    properties: AnalyticsEventMap[Name];
    occurredAt: string;
  };
}[AnalyticsEventName];

export type AnalyticsSink = (event: AnalyticsEvent) => void | Promise<void>;

export type AnalyticsClient = {
  track<Name extends AnalyticsEventName>(name: Name, properties: AnalyticsEventMap[Name]): Promise<boolean>;
};

export function createAnalyticsClient(options: {
  hasConsent: () => boolean;
  sink: AnalyticsSink;
  now?: () => Date;
}): AnalyticsClient {
  const now = options.now ?? (() => new Date());

  return {
    async track(name, properties) {
      if (!options.hasConsent()) return false;
      await options.sink({ name, properties, occurredAt: now().toISOString() } as AnalyticsEvent);
      return true;
    },
  };
}
