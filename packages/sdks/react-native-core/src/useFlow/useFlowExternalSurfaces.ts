import { useEffect, useRef, type MutableRefObject } from 'react';
import { findExternalSurface, type FlowState } from '@getrheo/flow-runtime';
import type { SdkResolveResponse } from '@getrheo/contracts';
import { resolveExternalSurfaceHostKey } from '@getrheo/contracts';
import type { StepResponse } from '@getrheo/flow-runtime';
import type { ExternalSurfacePresenter } from './types.js';
import type { ExternalSurfacesMap } from '../externalSurfaces/headless.js';
import type { EnqueueSdkFn } from './inputCaptureAnalytics.js';

export type UseFlowExternalSurfacesParams = {
  resolved: SdkResolveResponse | null;
  state: FlowState | null;
  presenterRef: MutableRefObject<ExternalSurfacePresenter>;
  /** Host component registry; when set, headless surfaces skip the promise presenter. */
  externalSurfacesRef: MutableRefObject<ExternalSurfacesMap | undefined>;
  respondRef: MutableRefObject<(r: StepResponse) => void>;
  enqueueSdk: EnqueueSdkFn;
};

export const useFlowExternalSurfaces = ({
  resolved,
  state,
  presenterRef,
  externalSurfacesRef,
  respondRef,
  enqueueSdk,
}: UseFlowExternalSurfacesParams): void => {
  const presentedSurfaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resolved || !state) return;
    const pending = state.pendingExternalSurface;
    if (!pending) {
      presentedSurfaceRef.current = null;
      return;
    }
    if (presentedSurfaceRef.current === pending.nodeId) return;
    const node = findExternalSurface(state.manifest, pending.nodeId);
    if (!node) return;
    presentedSurfaceRef.current = pending.nodeId;

    enqueueSdk({
      name: 'surface_presented',
      flowId: resolved.flowId,
      versionId: resolved.versionId,
      experimentId: resolved.experimentId,
      variantId: resolved.variantId,
      stepId: pending.nodeId,
      properties: {
        surface_node_id: pending.nodeId,
        provider: node.config.provider,
        ...(node.config.provider === 'revenuecat' && node.config.offeringId
          ? { offering_id: node.config.offeringId }
          : {}),
        ...(node.config.provider === 'superwall' && node.config.placementId
          ? { placement_id: node.config.placementId }
          : {}),
      },
    });

    // Headless: host component is rendered by `Flow`. If the host omitted a
    // registry entry, fail immediately so the flow can use Fallback.
    if (node.config.provider === 'headless') {
      const hostKey = resolveExternalSurfaceHostKey(node);
      const host = externalSurfacesRef.current?.[hostKey];
      if (!host) {
        enqueueSdk({
          name: 'surface_outcome',
          flowId: resolved.flowId,
          versionId: resolved.versionId,
          experimentId: resolved.experimentId,
          variantId: resolved.variantId,
          stepId: pending.nodeId,
          properties: {
            surface_node_id: pending.nodeId,
            provider: node.config.provider,
            outcome: 'failed',
          },
        });
        respondRef.current({
          kind: 'external_surface_outcome',
          nodeId: pending.nodeId,
          outcome: 'failed',
          sdkKeyPatch: { onb_surface_last_event: 'failed' },
        });
      }
      return;
    }

    let cancelled = false;
    void presenterRef
      .current(node)
      .then((result) => {
        if (cancelled) return;
        enqueueSdk({
          name: 'surface_outcome',
          flowId: resolved.flowId,
          versionId: resolved.versionId,
          experimentId: resolved.experimentId,
          variantId: resolved.variantId,
          stepId: pending.nodeId,
          properties: {
            surface_node_id: pending.nodeId,
            provider: node.config.provider,
            outcome: result.outcome,
          },
        });
        respondRef.current({
          kind: 'external_surface_outcome',
          nodeId: pending.nodeId,
          outcome: result.outcome,
          sdkKeyPatch: result.sdkKeyPatch,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // A presenter that throws is equivalent to a `failed` outcome from
        // the runtime's perspective; mirror the success path so dashboards
        // still see a `surface_outcome` row for the failure.
        enqueueSdk({
          name: 'surface_outcome',
          flowId: resolved.flowId,
          versionId: resolved.versionId,
          experimentId: resolved.experimentId,
          variantId: resolved.variantId,
          stepId: pending.nodeId,
          properties: {
            surface_node_id: pending.nodeId,
            provider: node.config.provider,
            outcome: 'failed',
          },
        });
        respondRef.current({
          kind: 'external_surface_outcome',
          nodeId: pending.nodeId,
          outcome: 'failed',
          sdkKeyPatch: { onb_rc_last_event: 'failed' },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [resolved, state, enqueueSdk, presenterRef, externalSurfacesRef, respondRef]);
};
