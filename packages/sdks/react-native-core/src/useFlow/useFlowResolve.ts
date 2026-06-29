import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { RHEO_DEFAULT_SDK_API_BASE_URL } from '@getrheo/contracts/sdk';
import { initFlowState, startFlow, type FlowState } from '@getrheo/flow-runtime';
import type { SdkResolveResponse } from '@getrheo/contracts';
import type { useRheo } from '../client.js';
import { resolveManifest } from '../resolve/resolveManifest.js';
import type { EnqueueSdkFn } from './inputCaptureAnalytics.js';
import { inferSdkPlatform } from './platform.js';
import { logReceivedFlowManifest } from './logReceivedFlowManifest.js';

type RheoConfig = ReturnType<typeof useRheo>;

export type UseFlowResolveParams = {
  channelInvalid: boolean;
  channelTrimmed: string;
  channelRef: MutableRefObject<string>;
  config: RheoConfig;
  flowEmitChannelRef: MutableRefObject<string>;
  resolvedRef: MutableRefObject<SdkResolveResponse | null>;
  stateRef: MutableRefObject<FlowState | null>;
  startedRef: MutableRefObject<boolean>;
  setResolved: Dispatch<SetStateAction<SdkResolveResponse | null>>;
  setState: Dispatch<SetStateAction<FlowState | null>>;
  setError: Dispatch<SetStateAction<Error | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  enqueueSdk: EnqueueSdkFn;
  resolveAttempt: number;
  /** True when `useFlow` synchronously seeded the running flow from the warm cache. */
  seeded: boolean;
};

export const useFlowResolve = ({
  channelInvalid,
  channelTrimmed,
  channelRef,
  config,
  flowEmitChannelRef,
  resolvedRef,
  stateRef,
  startedRef,
  setResolved,
  setState,
  setError,
  setLoading,
  enqueueSdk,
  resolveAttempt,
  seeded,
}: UseFlowResolveParams): void => {
  const runResolve = useCallback(
    (isCancelled: () => boolean) => {
      if (channelInvalid) {
        flowEmitChannelRef.current = '';
        resolvedRef.current = null;
        stateRef.current = null;
        setResolved(null);
        setState(null);
        setError(
          new Error(
            'useFlow: `channelId` is required — pass the channel public id (e.g. ch_test_…) from `Flow` or your screen.',
          ),
        );
        setLoading(false);
        return;
      }

      setError(null);
      setLoading(true);

      resolveManifest({
        apiBaseUrl: config.apiBaseUrl ?? RHEO_DEFAULT_SDK_API_BASE_URL,
        publishableKey: config.publishableKey,
        channelId: channelTrimmed,
        config,
      })
        .then((data) => {
          if (isCancelled()) return;
          logReceivedFlowManifest(data);
          flowEmitChannelRef.current = channelRef.current;
          setResolved(data);
          resolvedRef.current = data;
          const initial = startFlow(
            initFlowState(data.manifest, {
              locale: config.locale,
              platform: config.platform ?? inferSdkPlatform(),
              sdkAttributes: config.sdkAttributes ?? {},
            }),
          );
          setState(initial);
          stateRef.current = initial;
          setLoading(false);
          if (!startedRef.current) {
            startedRef.current = true;
            enqueueSdk({
              name: 'flow_started',
              flowId: data.flowId,
              versionId: data.versionId,
              experimentId: data.experimentId,
              variantId: data.variantId,
            });
          }
        })
        .catch((err: Error) => {
          if (isCancelled()) return;
          flowEmitChannelRef.current = '';
          resolvedRef.current = null;
          stateRef.current = null;
          setResolved(null);
          setState(null);
          setError(err);
          setLoading(false);
        });
    },
    [
      channelInvalid,
      channelTrimmed,
      channelRef,
      config,
      enqueueSdk,
      flowEmitChannelRef,
      resolvedRef,
      setError,
      setLoading,
      setResolved,
      setState,
      startedRef,
      stateRef,
    ],
  );

  // When `useFlow` seeded the running flow from the warm cache, the first effect
  // run must not re-resolve (which would reset an in-progress flow). Instead emit
  // `flow_started` once and revalidate in the background to refresh the cache for
  // next time, without hot-swapping the live manifest.
  const seededFirstRunRef = useRef(seeded);

  useEffect(() => {
    let cancelled = false;

    if (seededFirstRunRef.current) {
      seededFirstRunRef.current = false;
      const seed = resolvedRef.current;
      if (seed && !startedRef.current) {
        startedRef.current = true;
        flowEmitChannelRef.current = channelRef.current;
        enqueueSdk({
          name: 'flow_started',
          flowId: seed.flowId,
          versionId: seed.versionId,
          experimentId: seed.experimentId,
          variantId: seed.variantId,
        });
      }
      if (!channelInvalid) {
        // Cache-only refresh; result is intentionally ignored (no hot-swap).
        resolveManifest({
          apiBaseUrl: config.apiBaseUrl ?? RHEO_DEFAULT_SDK_API_BASE_URL,
          publishableKey: config.publishableKey,
          channelId: channelTrimmed,
          config,
        }).catch(() => {
          /* best-effort revalidation */
        });
      }
      return () => {
        cancelled = true;
      };
    }

    runResolve(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [runResolve, resolveAttempt]);
};
