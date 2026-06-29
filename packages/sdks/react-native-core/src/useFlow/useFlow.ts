import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { findScreen, type FlowState, type InterpolationContext } from '@getrheo/flow-runtime';
import type { SdkResolveResponse } from '@getrheo/contracts';
import { useEventQueue, useRheo } from '../client.js';
import type { UseFlowOptions, UseFlowResult, ExternalSurfacePresenter } from './types.js';
import { defaultExternalSurfacePresenter } from './types.js';
export type { UseFlowResult, UseFlowOptions, ExternalSurfacePresenter } from './types.js';
import { useFlowTelemetry } from './useFlowTelemetry.js';
import { useFlowResolve } from './useFlowResolve.js';
import { useFlowTerminal } from './useFlowTerminal.js';
import { useFlowExternalSurfaces } from './useFlowExternalSurfaces.js';
import { useFlowRespond } from './useFlowRespond.js';
import { useFlowActions } from './useFlowActions.js';
import { peekWarmSeed, type WarmSeed } from './warmSeed.js';

const emptyMediaMap: Record<string, string> = {};

/**
 * Resolve and run the flow assigned to this channel + publishable key.
 *
 * The SDK no longer takes a flowId — channels (dashboard routing) decide
 * what to serve. Pass the channel **public id** from the renderer.
 */
export const useFlow = ({
  channelId,
  externalSurfacePresenter,
  includeManifestInTerminalPayload,
  includePathInTerminalPayload,
  includeAnswerDetailInTerminalPayload,
  onFlowCompleted,
  onFlowAbandoned,
}: UseFlowOptions): UseFlowResult => {
  const config = useRheo();
  const queue = useEventQueue();
  const channelTrimmed = channelId.trim();
  const presenterRef = useRef<ExternalSurfacePresenter>(
    externalSurfacePresenter ?? defaultExternalSurfacePresenter,
  );
  presenterRef.current = externalSurfacePresenter ?? defaultExternalSurfacePresenter;
  const channelInvalid = channelTrimmed.length === 0;

  const channelRef = useRef(channelTrimmed);
  channelRef.current = channelTrimmed;

  // Tier 3 fast-path: if a prefetch warmed the in-memory cache, seed the running
  // flow synchronously so the first paint skips the loading spinner. Computed
  // once per hook instance.
  const warmSeedRef = useRef<WarmSeed | null | undefined>(undefined);
  if (warmSeedRef.current === undefined) {
    warmSeedRef.current = channelInvalid ? null : peekWarmSeed(channelTrimmed, config);
  }
  const warmSeed = warmSeedRef.current;
  const seeded = warmSeed != null;

  const [resolved, setResolved] = useState<SdkResolveResponse | null>(warmSeed?.resolved ?? null);
  const [state, setState] = useState<FlowState | null>(warmSeed?.state ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!seeded);
  const [resolveAttempt, setResolveAttempt] = useState(0);

  const retry = useCallback(() => {
    setResolveAttempt((n) => n + 1);
  }, []);

  const startedRef = useRef(false);
  const stateRef = useRef<FlowState | null>(warmSeed?.state ?? null);
  const resolvedRef = useRef<SdkResolveResponse | null>(warmSeed?.resolved ?? null);
  const lastViewedRef = useRef<string | null>(null);
  const respondRef = useRef<(r: import('@getrheo/flow-runtime').StepResponse) => void>(() => {});
  const configRef = useRef(config);
  useLayoutEffect(() => {
    configRef.current = config;
  }, [config]);

  const includeManifestRef = useRef(includeManifestInTerminalPayload ?? false);
  useLayoutEffect(() => {
    includeManifestRef.current = includeManifestInTerminalPayload ?? false;
  }, [includeManifestInTerminalPayload]);

  const includePathRef = useRef(includePathInTerminalPayload ?? false);
  useLayoutEffect(() => {
    includePathRef.current = includePathInTerminalPayload ?? false;
  }, [includePathInTerminalPayload]);

  const includeAnswerDetailRef = useRef(includeAnswerDetailInTerminalPayload ?? false);
  useLayoutEffect(() => {
    includeAnswerDetailRef.current = includeAnswerDetailInTerminalPayload ?? false;
  }, [includeAnswerDetailInTerminalPayload]);

  const onFlowCompletedRef = useRef(onFlowCompleted);
  const onFlowAbandonedRef = useRef(onFlowAbandoned);
  useLayoutEffect(() => {
    onFlowCompletedRef.current = onFlowCompleted;
    onFlowAbandonedRef.current = onFlowAbandoned;
  }, [onFlowCompleted, onFlowAbandoned]);

  const terminalHandledRef = useRef('');
  const flowEmitChannelRef = useRef(seeded ? channelTrimmed : '');
  const emittedAttributionSignalProvidersRef = useRef<Set<string>>(new Set());

  const { enqueueSdk, enqueueDecisionEvaluated } = useFlowTelemetry({
    config,
    queue,
    flowEmitChannelRef,
    resolvedRef,
    stateRef,
    resolved,
    state,
    channelTrimmed,
    startedRef,
    lastViewedRef,
    emittedAttributionSignalProvidersRef,
    terminalHandledRef,
    setState,
  });

  useFlowResolve({
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
  });

  useFlowTerminal({
    queue,
    flowEmitChannelRef,
    stateRef,
    resolvedRef,
    terminalHandledRef,
    configRef,
    includeManifestRef,
    includePathRef,
    includeAnswerDetailRef,
    onFlowCompletedRef,
    onFlowAbandonedRef,
    loading,
    resolved,
    state,
  });

  const screen = useMemo(
    () =>
      resolved?.manifest && state?.currentScreenId
        ? findScreen(resolved.manifest, state.currentScreenId)
        : undefined,
    [resolved?.manifest, state?.currentScreenId],
  );

  const interpolationContext = useMemo<InterpolationContext | undefined>(
    () =>
      state
        ? {
            responses: state.responses,
            customProperties: config.customProperties,
            canGoBack: state.history.length > 1,
          }
        : undefined,
    [state, config.customProperties],
  );

  const respond = useFlowRespond({
    stateRef,
    resolvedRef,
    setState,
    enqueueSdk,
    enqueueDecisionEvaluated,
  });

  useLayoutEffect(() => {
    respondRef.current = respond;
  }, [respond]);

  useFlowExternalSurfaces({
    resolved,
    state,
    presenterRef,
    respondRef,
    enqueueSdk,
  });

  const { abandon, relayNativeButtonAction, trackExternalLinkOpened, pendingExternalSurface } =
    useFlowActions({
      stateRef,
      resolvedRef,
      flowEmitChannelRef,
      respondRef,
      enqueueSdk,
      resolved,
      state,
      setState,
    });

  const resolveFailed = !loading && error != null && resolved == null;

  return {
    loading,
    error,
    resolveFailed,
    retry,
    state,
    screen,
    manifest: resolved?.manifest ?? null,
    pendingExternalSurface,
    flowId: resolved?.flowId ?? null,
    versionId: resolved?.versionId ?? null,
    variantId: resolved?.variantId ?? null,
    branding: resolved?.branding ?? null,
    mediaMap: resolved?.mediaMap ?? emptyMediaMap,
    respond,
    interpolationContext,
    relayNativeButtonAction,
    trackExternalLinkOpened,
    abandon,
  };
};
