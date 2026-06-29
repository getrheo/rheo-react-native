import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { ATTR_KEY_PROVIDER } from '@getrheo/attribution';
import type { DecisionEvaluationTelemetry, FlowState } from '@getrheo/flow-runtime';
import type { SdkResolveResponse } from '@getrheo/contracts';
import { createAttributionRuntime } from '../attribution/createAttributionRuntime.js';
import { getResolvedAppUserId, type TrackEventInput } from '../events.js';
import type { useRheo } from '../client.js';
import { shallowEqualSdkAttrs } from './platform.js';

type RheoConfig = ReturnType<typeof useRheo>;

export type UseFlowTelemetryParams = {
  config: RheoConfig;
  queue: { enqueue: (input: TrackEventInput, opts: { channelId: string }) => void };
  flowEmitChannelRef: MutableRefObject<string>;
  resolvedRef: MutableRefObject<SdkResolveResponse | null>;
  stateRef: MutableRefObject<FlowState | null>;
  resolved: SdkResolveResponse | null;
  state: FlowState | null;
  channelTrimmed: string;
  startedRef: MutableRefObject<boolean>;
  lastViewedRef: MutableRefObject<string | null>;
  emittedAttributionSignalProvidersRef: MutableRefObject<Set<string>>;
  terminalHandledRef: MutableRefObject<string>;
  setState: Dispatch<SetStateAction<FlowState | null>>;
};

export const useFlowTelemetry = ({
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
}: UseFlowTelemetryParams) => {
  const enqueueSdk = useCallback(
    (input: TrackEventInput) => {
      const ch = flowEmitChannelRef.current;
      if (!ch) return;
      queue.enqueue(input, { channelId: ch });
    },
    [flowEmitChannelRef, queue],
  );

  useLayoutEffect(() => {
    startedRef.current = false;
    lastViewedRef.current = null;
    emittedAttributionSignalProvidersRef.current.clear();
    terminalHandledRef.current = '';
  }, [channelTrimmed, emittedAttributionSignalProvidersRef, lastViewedRef, startedRef, terminalHandledRef]);

  const enqueueDecisionEvaluated = useCallback(
    (payload: DecisionEvaluationTelemetry) => {
      const data = resolvedRef.current;
      if (!data) return;
      enqueueSdk({
        name: 'decision_evaluated',
        flowId: data.flowId,
        versionId: data.versionId,
        experimentId: data.experimentId,
        variantId: data.variantId,
        properties: {
          decision_node_id: payload.decisionNodeId,
          matched_case_id: payload.matchedCaseId,
          used_else_branch: payload.matchedCaseId === null,
          clause_digest: payload.clauseDigest,
        },
      });
    },
    [enqueueSdk, resolvedRef],
  );

  const canRunAttribution = useMemo(() => {
    if (config.attribution?.enabled === false) return false;
    if (!resolved) return false;
    if (resolved.features?.attribution === false) return false;
    if (resolved.integrations?.appsflyer?.enabled !== true) return false;
    return true;
  }, [resolved, config.attribution?.enabled]);

  const [attributionSdk, setAttributionSdk] = useState<Record<string, unknown>>({});

  const mergedSdkAttributes = useMemo(
    () => ({ ...(config.sdkAttributes ?? {}), ...attributionSdk }),
    [config.sdkAttributes, attributionSdk],
  );

  useEffect(() => {
    if (!canRunAttribution) {
      setAttributionSdk({});
      emittedAttributionSignalProvidersRef.current.clear();
      return undefined;
    }
    const rt = createAttributionRuntime({
      enabled: true,
      cacheEnabled: config.attribution?.cache !== false,
      cacheTtlMs: config.attribution?.cacheTtlMs,
      storageNamespace: getResolvedAppUserId(config),
      storage: config.attribution?.storage,
      providers: config.attribution?.providers,
    });
    const unsub = rt.subscribe(setAttributionSdk);
    return () => {
      unsub();
      rt.dispose();
    };
  }, [
    canRunAttribution,
    config.attribution?.cache,
    config.attribution?.cacheTtlMs,
    config.attribution?.storage,
    config.attribution?.providers,
    config.userId,
    emittedAttributionSignalProvidersRef,
  ]);

  useEffect(() => {
    setState((prev) => {
      if (!prev) return prev;
      if (shallowEqualSdkAttrs(prev.session.sdkAttributes, mergedSdkAttributes)) return prev;
      const next = {
        ...prev,
        session: { ...prev.session, sdkAttributes: mergedSdkAttributes },
      };
      stateRef.current = next;
      return next;
    });
  }, [mergedSdkAttributes, setState, stateRef]);

  useEffect(() => {
    if (!canRunAttribution) return;
    const data = resolvedRef.current;
    if (!data) return;
    if (!flowEmitChannelRef.current) return;
    const raw = mergedSdkAttributes[ATTR_KEY_PROVIDER];
    if (typeof raw !== 'string') return;
    const pid = raw.trim().toLowerCase();
    if (!pid || !/^[a-z0-9_-]+$/.test(pid)) return;
    if (emittedAttributionSignalProvidersRef.current.has(pid)) return;
    emittedAttributionSignalProvidersRef.current.add(pid);
    enqueueSdk({
      name: 'attribution_context_observed',
      flowId: data.flowId,
      versionId: data.versionId,
      experimentId: data.experimentId,
      variantId: data.variantId,
      properties: { attribution_provider: pid },
    });
  }, [
    canRunAttribution,
    mergedSdkAttributes,
    enqueueSdk,
    flowEmitChannelRef,
    resolvedRef,
    emittedAttributionSignalProvidersRef,
  ]);

  useEffect(() => {
    if (!resolved || !state) return;
    if (lastViewedRef.current === state.currentScreenId) return;
    lastViewedRef.current = state.currentScreenId;
    enqueueSdk({
      name: 'step_viewed',
      flowId: resolved.flowId,
      versionId: resolved.versionId,
      experimentId: resolved.experimentId,
      variantId: resolved.variantId,
      stepId: state.currentScreenId,
    });
  }, [resolved, state?.currentScreenId, enqueueSdk, lastViewedRef]);

  return { enqueueSdk, enqueueDecisionEvaluated, mergedSdkAttributes, canRunAttribution };
};
