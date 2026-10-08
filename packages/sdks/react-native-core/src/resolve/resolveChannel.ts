import type { CodeParameterValue } from '@getrheo/contracts/contentKind';
import { EXPERIMENT_EXPOSED_EVENT } from '@getrheo/contracts/codeChannelEvents';
import {
  codeResolveEtag,
  SdkBannerResolveResponseSchema,
  SdkCodeResolveResponseSchema,
  type SdkBannerResolveResponse,
  type SdkCodeResolveResponse,
} from '@getrheo/contracts/sdkChannel';
import { SdkResolveResponseSchema, type SdkResolveResponse } from '@getrheo/contracts/sdk';
import { mapChannelError } from '../client.js';
import { generateEventId, getResolvedAppUserId } from '../events.js';
import type { useRheo } from '../client.js';
import {
  loadManifestResolveCache,
  manifestResolveCacheKey,
  saveManifestResolveCache,
  shouldSendManifestConditional,
} from './manifestResolveCache.js';

type RheoConfig = ReturnType<typeof useRheo>;

export type CodeChannel = SdkCodeResolveResponse & {
  get: <T extends CodeParameterValue>(key: string, fallback: T) => T;
};

export type BannerChannel = SdkBannerResolveResponse;

export type RheoChannel = SdkResolveResponse | CodeChannel | BannerChannel;

const jsonType = (value: unknown): string => (value === null ? 'null' : typeof value);

export const withCodeGet = (body: SdkCodeResolveResponse): CodeChannel => ({
  ...body,
  get: (key, fallback) => {
    if (!Object.prototype.hasOwnProperty.call(body.parameters, key)) return fallback;
    const value = body.parameters[key];
    if (jsonType(value) !== jsonType(fallback)) return fallback;
    return value as typeof fallback;
  },
});

const codeCache = new Map<string, { etag: string; body: SdkCodeResolveResponse }>();

export const loadCodeResolveCache = (
  key: string,
): { etag: string; body: SdkCodeResolveResponse } | null => codeCache.get(key) ?? null;

export const saveCodeResolveCache = (
  key: string,
  entry: { etag: string; body: SdkCodeResolveResponse },
): void => {
  codeCache.set(key, entry);
};

export const clearCodeResolveCacheForTests = (): void => {
  codeCache.clear();
  loggedExposure.clear();
  activeByChannel.clear();
};

const parseEtag = (response: Response): string | null => {
  const raw = response.headers.get('etag') ?? response.headers.get('ETag');
  return raw?.trim() ? raw.trim() : null;
};

const inFlight = new Map<string, Promise<RheoChannel | null>>();

export const resolveChannel = (params: {
  apiBaseUrl: string;
  publishableKey: string;
  channelId: string;
  config: RheoConfig;
  fetcher?: typeof fetch;
}): Promise<RheoChannel | null> => {
  const channelId = params.channelId.trim();
  const cacheKey = manifestResolveCacheKey(
    params.apiBaseUrl,
    params.publishableKey,
    channelId,
    params.config.locale,
  );
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;
  const promise = runResolve({ ...params, channelId, cacheKey }).finally(() => {
    inFlight.delete(cacheKey);
  });
  inFlight.set(cacheKey, promise);
  return promise;
};

const runResolve = async ({
  apiBaseUrl,
  publishableKey,
  channelId,
  config,
  fetcher = config.fetcher ?? fetch,
  cacheKey,
}: {
  apiBaseUrl: string;
  publishableKey: string;
  channelId: string;
  config: RheoConfig;
  fetcher?: typeof fetch;
  cacheKey: string;
}): Promise<RheoChannel | null> => {
  const flowCached = await loadManifestResolveCache(cacheKey);
  const codeCached = loadCodeResolveCache(cacheKey);
  const headers: Record<string, string> = {
    authorization: `Bearer ${publishableKey}`,
    'content-type': 'application/json',
    'x-rheo-channel': channelId,
  };
  const conditional = flowCached && shouldSendManifestConditional(flowCached)
    ? flowCached.etag
    : codeCached?.etag;
  if (conditional) headers['if-none-match'] = conditional;

  const response = await fetcher(`${apiBaseUrl}/v1/sdk/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      identity: { appUserId: getResolvedAppUserId(config) },
      context: config.locale ? { locale: config.locale } : undefined,
    }),
  });
  if (response.status === 404) return null;
  if (response.status === 304) {
    if (codeCached && !flowCached) return withCodeGet(codeCached.body);
    if (flowCached && shouldSendManifestConditional(flowCached)) return flowCached.body;
    if (codeCached) return withCodeGet(codeCached.body);
    throw new Error('resolve returned 304 without a local channel cache entry');
  }
  if (!response.ok) throw await mapChannelError(response);
  const json: unknown = await response.json();
  const kind = (json as { kind?: string }).kind;
  const etag = parseEtag(response);
  if (kind === 'code') {
    const body = SdkCodeResolveResponseSchema.parse(json);
    saveCodeResolveCache(cacheKey, {
      etag: etag ?? codeResolveEtag(body.assignmentVersion, body.variantKey, body.parameters),
      body,
    });
    return withCodeGet(body);
  }
  if (kind === 'banner') {
    return SdkBannerResolveResponseSchema.parse(json);
  }
  if (kind != null && kind !== 'flow') {
    throw new Error(`unsupported channel kind: ${kind}`);
  }
  const flow = kind === 'flow' ? SdkResolveResponseSchema.parse(json) : (json as SdkResolveResponse);
  if (etag) {
    await saveManifestResolveCache(cacheKey, { etag, body: flow, cachedAt: Date.now() });
  }
  return flow;
};

type ActiveCodeExperiment = {
  experimentId: string;
  variantId: string;
};

const activeByChannel = new Map<string, ActiveCodeExperiment | null>();
const loggedExposure = new Set<string>();

export const exposureKey = (
  appUserId: string,
  experimentId: string,
  variantId: string,
  assignmentVersion: number,
): string => `${appUserId}:${experimentId}:${variantId}:${assignmentVersion}`;

export const rememberCodeResolve = (
  channelId: string,
  channel: RheoChannel | null,
): void => {
  const experiment =
    channel && (channel.kind === 'code' || channel.kind === 'banner')
      ? channel.experiment
      : null;
  if (!experiment) {
    activeByChannel.set(channelId, null);
    return;
  }
  activeByChannel.set(channelId, {
    experimentId: experiment.id,
    variantId: experiment.variantId,
  });
};

export const logCodeExposure = async (params: {
  apiBaseUrl: string;
  publishableKey: string;
  channelId: string;
  config: RheoConfig;
  channel: CodeChannel;
  fetcher?: typeof fetch;
}): Promise<void> => {
  if (!params.channel.experiment) return;
  const appUserId = getResolvedAppUserId(params.config);
  const key = exposureKey(
    appUserId,
    params.channel.experiment.id,
    params.channel.experiment.variantId,
    params.channel.assignmentVersion,
  );
  if (loggedExposure.has(key)) return;
  loggedExposure.add(key);
  const fetcher = params.fetcher ?? params.config.fetcher ?? fetch;
  await fetcher(`${params.apiBaseUrl}/v1/sdk/code-events`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.publishableKey}`,
      'content-type': 'application/json',
      'x-rheo-channel': params.channelId,
    },
    body: JSON.stringify({
      events: [
        {
          eventId: generateEventId(),
          name: EXPERIMENT_EXPOSED_EVENT,
          timestamp: new Date().toISOString(),
          experimentId: params.channel.experiment.id,
          variantId: params.channel.experiment.variantId,
          identity: { appUserId },
          context: params.config.locale ? { locale: params.config.locale } : undefined,
        },
      ],
    }),
  });
};

export const logChannelEvent = (params: {
  apiBaseUrl: string;
  publishableKey: string;
  channelId: string;
  config: RheoConfig;
  name: string;
  properties?: Record<string, string | number | boolean | null>;
  fetcher?: typeof fetch;
}): void => {
  const active = activeByChannel.get(params.channelId.trim());
  const fetcher = params.fetcher ?? params.config.fetcher ?? fetch;
  void fetcher(`${params.apiBaseUrl}/v1/sdk/code-events`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.publishableKey}`,
      'content-type': 'application/json',
      'x-rheo-channel': params.channelId.trim(),
    },
    body: JSON.stringify({
      events: [
        {
          eventId: generateEventId(),
          name: params.name,
          timestamp: new Date().toISOString(),
          experimentId: active?.experimentId ?? null,
          variantId: active?.variantId ?? null,
          identity: { appUserId: getResolvedAppUserId(params.config) },
          context: params.config.locale ? { locale: params.config.locale } : undefined,
          ...(params.properties ? { properties: params.properties } : {}),
        },
      ],
    }),
  });
};
