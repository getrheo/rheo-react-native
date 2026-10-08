let current: Record<string, string | number | boolean> = {};
let settled = false;
let resolveReady: () => void = () => undefined;
let ready: Promise<void> = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

const installReady = () => {
  settled = false;
  ready = new Promise<void>((resolve) => {
    resolveReady = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
  });
};

installReady();

/** Latest AppsFlyer (or other provider) keys, copied onto product-analytics events. */
export const setNativeProductAnalyticsAttribution = (attrs: Record<string, unknown>): void => {
  const next: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value;
    }
  }
  current = next;
  if (Object.keys(next).length > 0) settleNativeProductAnalyticsAttribution();
};

/** The snapshot is known, including a known-empty snapshot when attribution will not run. */
export const settleNativeProductAnalyticsAttribution = (): void => {
  resolveReady();
};

export const whenNativeProductAnalyticsAttributionReady = (): Promise<void> => ready;

export const currentNativeProductAnalyticsAttribution = (): Record<string, string | number | boolean> =>
  current;

/** Test isolation. Production callers should not reset a settled snapshot. */
export const resetNativeProductAnalyticsAttributionForTests = (): void => {
  current = {};
  installReady();
};
