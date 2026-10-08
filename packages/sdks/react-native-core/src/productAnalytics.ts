import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ProductAnalyticsClient,
  type ProductAnalyticsPropertyMap,
  type ProductAnalyticsStorage,
  type SdkContext,
} from '@getrheo/contracts';
import { generateEventId, getResolvedAppUserId, type SdkEventBuildConfig } from './events';
import { createSdkLogger, type SdkLogger } from './logging/sdkLogger';
import { ProductAnalyticsQueue, type ProductAnalyticsTransport } from './productAnalyticsQueue';
import {
  currentNativeProductAnalyticsAttribution,
  whenNativeProductAnalyticsAttributionReady,
} from './productAnalyticsAttribution';
import { inferSdkPlatform, nativeProductAnalyticsClient } from './useFlow/platform';

export type AppAnalyticsRuntime = {
  logEvent: (name: string, properties?: ProductAnalyticsPropertyMap) => void;
  screen: (name: string, properties?: ProductAnalyticsPropertyMap) => void;
  setUserId: (id: string | null | undefined) => void;
};

let runtime: AppAnalyticsRuntime | null = null;

const registerRuntime = (next: AppAnalyticsRuntime | null): void => {
  runtime = next;
};

export const logEvent = (name: string, properties?: ProductAnalyticsPropertyMap): void => {
  runtime?.logEvent(name, properties);
};

export const screen = (name: string, properties?: ProductAnalyticsPropertyMap): void => {
  runtime?.screen(name, properties);
};

export const setUserId = (id: string | null | undefined): void => {
  runtime?.setUserId(id);
};

type BillingTransport = ProductAnalyticsTransport & { getAppUserId: () => string };
let billingTransport: BillingTransport | null = null;

/** Registers the host's RevenueCat or Superwall user id. Rheo does not import those SDKs. */
export const setBillingIdentity = (
  provider: 'revenuecat' | 'superwall',
  externalId: string | null | undefined,
): void => {
  const transport = billingTransport;
  const id = externalId?.trim();
  if (!transport || !id) return;
  const fetcher = transport.fetcher ?? fetch;
  void fetcher(`${transport.apiBaseUrl}/v1/sdk/billing-identities`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${transport.publishableKey}`,
    },
    body: JSON.stringify({
      appUserId: transport.getAppUserId(),
      provider,
      externalId: id,
    }),
  }).catch(() => undefined);
};

type NavRoute = { name?: string; state?: NavState };
type NavState = { index?: number; routes?: NavRoute[] };

/** Focused route name from a React Navigation state, including nested stacks. */
export const focusedRouteName = (state: NavState | null | undefined): string | null => {
  if (!state?.routes?.length) return null;
  const index = typeof state.index === 'number' ? state.index : 0;
  const route = state.routes[index] ?? state.routes[0];
  if (!route) return null;
  const nested = route.state ? focusedRouteName(route.state) : null;
  if (nested) return nested;
  const name = route.name?.trim();
  return name || null;
};

/** Records `screen_view` for the focused route. Pass React Navigation's `onStateChange` state. */
export const bindNavigationState = (state: unknown): void => {
  const name = focusedRouteName(state as NavState | null);
  if (name) screen(name);
};

const nativeStorage = (): ProductAnalyticsStorage => ({
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
});

export const startNativeProductAnalytics = ({
  enabled,
  transport,
  getBuildConfig,
  onUserId,
  logger,
}: {
  enabled: boolean;
  transport: ProductAnalyticsTransport;
  getBuildConfig: () => SdkEventBuildConfig;
  onUserId: (id: string | undefined) => void;
  logger?: SdkLogger;
}): (() => void) => {
  billingTransport = {
    ...transport,
    getAppUserId: () => getResolvedAppUserId(getBuildConfig()),
  };
  if (!enabled) {
    registerRuntime(null);
    return () => {
      billingTransport = null;
    };
  }
  const queue = new ProductAnalyticsQueue(transport, logger ?? createSdkLogger('silent'));
  const client = new ProductAnalyticsClient({
    storage: nativeStorage(),
    enqueue: queue.enqueue,
    createId: generateEventId,
    firstEventName: 'first_open',
    getIdentity: () => {
      const config = getBuildConfig();
      return {
        appUserId: getResolvedAppUserId(config),
        ...(config.customUserId ? { customUserId: config.customUserId } : {}),
      };
    },
    whenAttributionReady: whenNativeProductAnalyticsAttributionReady,
    getContext: (): SdkContext => {
      const config = getBuildConfig();
      const attribution = currentNativeProductAnalyticsAttribution();
      const client = nativeProductAnalyticsClient();
      return {
        platform: config.platform ?? inferSdkPlatform(),
        ...(config.locale ? { locale: config.locale } : {}),
        ...(config.appVersion ? { appVersion: config.appVersion } : {}),
        ...(client.os ? { os: client.os } : {}),
        ...(client.device ? { device: client.device } : {}),
        ...(config.customProperties ? { customProperties: config.customProperties } : {}),
        ...(Object.keys(attribution).length > 0 ? { attribution } : {}),
      };
    },
  });
  registerRuntime({
    logEvent: client.logEvent,
    screen: (name, properties) => client.view('screen_view', name, properties),
    setUserId: (id) => {
      client.setUserId(id);
      onUserId(id?.trim() ? id.trim() : undefined);
    },
  });
  void client.start();
  return () => {
    billingTransport = null;
    registerRuntime(null);
    queue.dispose();
  };
};
