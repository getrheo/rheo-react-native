import { mergeAttributionSnapshots, type NormalizedAttributionSnapshot } from '@getrheo/attribution';
import type {AttributionRuntimeProvider} from '../attributionTypes';

const PROVIDER_ID = 'appsflyer' as const;

const readRecord = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object') return {};
  return raw as Record<string, unknown>;
};

/** AppsFlyer RN wraps payloads differently across versions — unwrap common shapes. */
export const extractAppsFlyerPayload = (root: unknown): Record<string, unknown> => {
  const r = readRecord(root);
  if ('data' in r && r.data && typeof r.data === 'object') {
    return readRecord(r.data);
  }
  return r;
};

const str = (row: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
};

/** Maps install / conversion payloads (`onInstallConversionData`). */
export const normalizeAppsFlyerConversionPayload = (root: unknown): NormalizedAttributionSnapshot => {
  const row = extractAppsFlyerPayload(root);
  const afStatus = str(row, 'af_status') ?? '';
  const isOrganic = afStatus.toLowerCase() === 'organic';

  const params: Record<string, string> = {};
  for (let i = 1; i <= 10; i += 1) {
    const k = `af_sub${i}`;
    const v = str(row, k);
    if (v) params[`sub_${i}`] = v;
  }

  return {
    providerId: PROVIDER_ID,
    capturedAtMs: Date.now(),
    attribution: {
      isOrganic,
      matchType: str(row, 'match_type') ?? str(row, 'af_match_type'),
      confidence: undefined,
    },
    acquisition: {
      source: str(row, 'media_source') ?? str(row, 'pid'),
      campaign: str(row, 'campaign') ?? str(row, 'af_campaign'),
      campaignId: str(row, 'campaign_id') ?? str(row, 'af_campaign_id'),
      adset: str(row, 'adset') ?? str(row, 'af_adset'),
      adsetId: str(row, 'adset_id') ?? str(row, 'af_adset_id'),
      creative: str(row, 'ad') ?? str(row, 'af_ad'),
      creativeId: str(row, 'ad_id') ?? str(row, 'af_ad_id'),
      channel: str(row, 'channel'),
    },
    link: {
      entry: str(row, 'deep_link_value') ?? str(row, 'af_dp'),
      params: Object.keys(params).length ? params : undefined,
    },
  };
};

/** Maps deep-link / OneLink callbacks (`onDeepLink`). */
export const normalizeAppsFlyerDeepLinkPayload = (root: unknown): NormalizedAttributionSnapshot => {
  const row = readRecord(root);
  const deep = readRecord(row.deepLink ?? row.deep_link ?? row.data ?? row);

  const payload = extractAppsFlyerPayload(deep);

  const params: Record<string, string> = {};
  const mergeParams = (src: Record<string, unknown>): void => {
    for (const [k, v] of Object.entries(src)) {
      const safeKey = k.replace(/\./g, '_');
      if (typeof v === 'string' && v.length > 0) params[safeKey] = v;
      else if (typeof v === 'number' && Number.isFinite(v)) params[safeKey] = String(v);
    }
  };

  if (payload.click_event && typeof payload.click_event === 'object') {
    mergeParams(readRecord(payload.click_event));
  }
  mergeParams(payload);

  const afStatus = str(payload, 'af_status');
  const isOrganic = afStatus ? afStatus.toLowerCase() === 'organic' : undefined;

  return {
    providerId: PROVIDER_ID,
    capturedAtMs: Date.now(),
    attribution: {
      ...(isOrganic !== undefined ? { isOrganic } : {}),
      matchType: str(payload, 'match_type') ?? str(payload, 'af_match_type'),
    },
    acquisition: {
      source: str(payload, 'media_source') ?? str(payload, 'pid'),
      campaign: str(payload, 'campaign') ?? str(payload, 'af_campaign'),
      campaignId: str(payload, 'campaign_id') ?? str(payload, 'af_campaign_id'),
      adset: str(payload, 'adset') ?? str(payload, 'af_adset'),
      adsetId: str(payload, 'adset_id') ?? str(payload, 'af_adset_id'),
      creative: str(payload, 'ad') ?? str(payload, 'af_ad'),
      creativeId: str(payload, 'ad_id') ?? str(payload, 'af_ad_id'),
      channel: str(payload, 'channel'),
    },
    link: {
      entry: str(payload, 'deep_link_value') ?? str(deep, 'deep_link_value') ?? str(row, 'deep_link_value'),
      params: Object.keys(params).length ? params : undefined,
    },
  };
};

export const createAppsFlyerAttributionProvider = (): AttributionRuntimeProvider => {
  let aggregate: NormalizedAttributionSnapshot | null = null;

  return {
    id: PROVIDER_ID,
    subscribe(listener: (snapshot: NormalizedAttributionSnapshot | null) => void): () => void {
      type AppsFlyerModule = {
        default?: {
          onInstallConversionData?: (cb: (res: unknown) => void) => void;
          onDeepLink?: (cb: (res: unknown) => void) => void;
        };
        onInstallConversionData?: (cb: (res: unknown) => void) => void;
        onDeepLink?: (cb: (res: unknown) => void) => void;
      };

      let mod: AppsFlyerModule | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mod = require('react-native-appsflyer') as AppsFlyerModule;
      } catch {
        return () => {};
      }

      const AF = mod.default ?? mod;

      const emit = (): void => listener(aggregate);

      if (typeof AF.onInstallConversionData === 'function') {
        AF.onInstallConversionData((res: unknown) => {
          const snap = normalizeAppsFlyerConversionPayload(res);
          aggregate = aggregate ? mergeAttributionSnapshots(aggregate, snap) : snap;
          emit();
        });
      }

      if (typeof AF.onDeepLink === 'function') {
        AF.onDeepLink((res: unknown) => {
          const snap = normalizeAppsFlyerDeepLinkPayload(res);
          aggregate = aggregate ? mergeAttributionSnapshots(aggregate, snap) : snap;
          emit();
        });
      }

      return () => {};
    },
  };
};
