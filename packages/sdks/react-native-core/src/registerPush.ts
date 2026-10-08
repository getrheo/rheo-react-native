import type { SdkPushRegisterRequest, SdkPushRegisterResponse } from '@getrheo/contracts';
import { RHEO_DEFAULT_SDK_API_BASE_URL } from '@getrheo/contracts/sdk';
import type { RheoConfig } from './client';
import { getResolvedAppUserId } from './events';
import { getSdkLogger } from './logging/sdkLogger';
import { getPushTokenAdapter } from './platform/pushTokenAdapter';

/** Token the host already has. Omit to read the registered platform adapter. */
export type RegisterPushInput = {
  token: string;
  platform: 'ios' | 'android';
  provider: 'apns' | 'fcm';
};

type CachedPushRegistration = RegisterPushInput & { appUserId: string };

let activeConfig: RheoConfig | null = null;
let cached: CachedPushRegistration | null = null;

/** @internal Current provider config for `registerPush()` outside the React tree. */
export const bindActivePushConfig = (config: RheoConfig | null): void => {
  activeConfig = config;
};

const resolveConfig = (config?: RheoConfig): RheoConfig => {
  const resolved = config ?? activeConfig;
  if (!resolved?.publishableKey) {
    throw new Error('registerPush requires a RheoProvider or a config argument.');
  }
  return resolved;
};

const postJson = async (
  config: RheoConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> => {
  const apiBaseUrl = config.apiBaseUrl ?? RHEO_DEFAULT_SDK_API_BASE_URL;
  const fetcher = config.fetcher ?? fetch;
  return fetcher(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.publishableKey}`,
    },
    body: JSON.stringify(body),
  });
};

const readToken = async (input?: RegisterPushInput): Promise<RegisterPushInput> => {
  if (input?.token) return input;
  const adapter = getPushTokenAdapter();
  if (!adapter) {
    throw new Error(
      'No push token adapter is registered. Call registerPushTokenAdapter, or pass { token, platform, provider }.',
    );
  }
  const device = await adapter.getDevicePushToken();
  if (!device?.token) {
    throw new Error('Push token adapter did not return a device token.');
  }
  return device;
};

/**
 * Upload the current device token for the resolved `appUserId`.
 * `registerPush()` reads the platform adapter. Pass a token when the host already has one.
 */
export const registerPush = async (
  input?: RegisterPushInput,
  config?: RheoConfig,
): Promise<SdkPushRegisterResponse> => {
  const resolved = resolveConfig(config);
  const token = await readToken(input);
  const appUserId = getResolvedAppUserId(resolved);
  const body: SdkPushRegisterRequest = {
    appUserId,
    platform: token.platform,
    provider: token.provider,
    token: token.token,
  };
  const response = await postJson(resolved, '/v1/sdk/push/register', body);
  if (!response.ok) {
    throw new Error(`push register failed: ${response.status}`);
  }
  cached = { ...token, appUserId };
  return (await response.json()) as SdkPushRegisterResponse;
};

/** Revoke the cached device token. No-op when nothing was registered. */
export const unregisterPush = async (config?: RheoConfig): Promise<void> => {
  if (!cached) return;
  const resolved = resolveConfig(config);
  const response = await postJson(resolved, '/v1/sdk/push/unregister', {
    appUserId: cached.appUserId,
    token: cached.token,
  });
  cached = null;
  if (!response.ok) {
    throw new Error(`push unregister failed: ${response.status}`);
  }
};

/**
 * Re-post the cached token when `userId` changes. Network failures are logged
 * and do not throw, so a provider update cannot break render.
 */
export const rebindCachedPushRegistration = async (config: RheoConfig): Promise<void> => {
  if (!cached) return;
  const appUserId = getResolvedAppUserId(config);
  if (appUserId === cached.appUserId) return;
  try {
    await registerPush(
      { token: cached.token, platform: cached.platform, provider: cached.provider },
      config,
    );
  } catch (error) {
    getSdkLogger().warn('[rheo] push re-register failed', error);
  }
};

/** @internal */
export const __resetPushRegistrationForTests = (): void => {
  cached = null;
  activeConfig = null;
};
