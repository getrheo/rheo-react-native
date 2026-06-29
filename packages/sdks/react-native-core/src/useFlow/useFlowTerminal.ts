import { useEffect, type MutableRefObject } from 'react';
import type { FlowState } from '@getrheo/flow-runtime';
import type { FlowTerminalSnapshot, SdkResolveResponse } from '@getrheo/contracts';
import { buildTerminalSnapshot } from '../terminalSnapshot.js';
import { getResolvedAppUserId, type TrackEventInput } from '../events.js';
import type { useRheo } from '../client.js';

type RheoConfig = ReturnType<typeof useRheo>;

export type UseFlowTerminalParams = {
  queue: { enqueue: (input: TrackEventInput, opts: { channelId: string }) => void };
  flowEmitChannelRef: MutableRefObject<string>;
  stateRef: MutableRefObject<FlowState | null>;
  resolvedRef: MutableRefObject<SdkResolveResponse | null>;
  terminalHandledRef: MutableRefObject<string>;
  configRef: MutableRefObject<RheoConfig>;
  includeManifestRef: MutableRefObject<boolean>;
  includePathRef: MutableRefObject<boolean>;
  includeAnswerDetailRef: MutableRefObject<boolean>;
  onFlowCompletedRef: MutableRefObject<((s: FlowTerminalSnapshot) => void) | undefined>;
  onFlowAbandonedRef: MutableRefObject<((s: FlowTerminalSnapshot) => void) | undefined>;
  loading: boolean;
  resolved: SdkResolveResponse | null;
  state: FlowState | null;
};

export const useFlowUnmountAbandon = ({
  queue,
  flowEmitChannelRef,
  stateRef,
  resolvedRef,
}: Pick<
  UseFlowTerminalParams,
  'queue' | 'flowEmitChannelRef' | 'stateRef' | 'resolvedRef'
>): void => {
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      const r = resolvedRef.current;
      const ch = flowEmitChannelRef.current;
      if (!s || !r || !ch) return;
      if (s.status === 'completed' || s.status === 'abandoned') return;
      queue.enqueue(
        {
          name: 'flow_abandoned',
          flowId: r.flowId,
          versionId: r.versionId,
          experimentId: r.experimentId,
          variantId: r.variantId,
          stepId: s.currentScreenId,
        },
        { channelId: ch },
      );
    };
  }, [queue, flowEmitChannelRef, resolvedRef, stateRef]);
};

export const useFlowTerminalCallbacks = ({
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
}: Omit<UseFlowTerminalParams, 'queue' | 'flowEmitChannelRef' | 'stateRef' | 'resolvedRef'>): void => {
  useEffect(() => {
    if (loading || !resolved || !state) return;
    if (state.status !== 'completed' && state.status !== 'abandoned') return;

    const terminal = state.status;
    const cb =
      terminal === 'completed' ? onFlowCompletedRef.current : onFlowAbandonedRef.current;
    if (!cb) return;

    const key = `${terminal}-${state.completedAt ?? ''}`;
    if (terminalHandledRef.current === key) return;
    terminalHandledRef.current = key;

    const snapshot = buildTerminalSnapshot({
      terminal,
      resolved,
      state,
      subject: {
        appUserId: getResolvedAppUserId(configRef.current),
        ...(configRef.current.customUserId
          ? { customUserId: configRef.current.customUserId }
          : {}),
        ...(configRef.current.sessionId ? { sessionId: configRef.current.sessionId } : {}),
      },
      appVersion: configRef.current.appVersion,
      customProperties: configRef.current.customProperties,
      includeManifest: includeManifestRef.current,
      includePath: includePathRef.current,
      includeAnswerDetail: includeAnswerDetailRef.current,
    });

    queueMicrotask(() => {
      if (terminal === 'completed') {
        onFlowCompletedRef.current?.(snapshot);
      } else {
        onFlowAbandonedRef.current?.(snapshot);
      }
    });
  }, [
    loading,
    resolved,
    state,
    configRef,
    includeAnswerDetailRef,
    includeManifestRef,
    includePathRef,
    onFlowAbandonedRef,
    onFlowCompletedRef,
    terminalHandledRef,
  ]);
};

export const useFlowTerminal = (params: UseFlowTerminalParams): void => {
  useFlowUnmountAbandon(params);
  useFlowTerminalCallbacks(params);
};
