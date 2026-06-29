import { useEffect, useRef, type MutableRefObject } from 'react';
import { findExternalSurface, type FlowState } from '@getrheo/flow-runtime';
import type { SdkResolveResponse } from '@getrheo/contracts';
import type { StepResponse } from '@getrheo/flow-runtime';
import type { ExternalSurfacePresenter } from './types.js';
import type { EnqueueSdkFn } from './inputCaptureAnalytics.js';

export type UseFlowExternalSurfacesParams = {
  resolved: SdkResolveResponse | null;
  state: FlowState | null;
  presenterRef: MutableRefObject<ExternalSurfacePresenter>;
  respondRef: MutableRefObject<(r: StepResponse) => void>;
  enqueueSdk: EnqueueSdkFn;
};

export const useFlowExternalSurfaces = ({
  resolved,
  state,
  presenterRef,
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
      },
    });

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
        if (result.outcome === 'purchase_completed') {
          const commerce = result.commerce;
          const productId = commerce?.product_id;
          const offeringId =
            commerce?.offering_id ??
            (node.config.provider === 'revenuecat' ? node.config.offeringId : undefined);
          if (productId) {
            const properties: Record<string, string | number> = {
              provider: node.config.provider,
              surface_node_id: pending.nodeId,
              product_id: productId,
            };
            if (offeringId) properties.offering_id = offeringId;
            if (commerce?.package_id) properties.package_id = commerce.package_id;
            if (commerce?.period_type) properties.period_type = commerce.period_type;
            // Price + currency must travel together; the adapter strips one
            // when the other is missing, so this check is belt + suspenders.
            if (
              typeof commerce?.price === 'number' &&
              typeof commerce?.currency === 'string'
            ) {
              properties.price = commerce.price;
              properties.currency = commerce.currency;
            }
            enqueueSdk({
              name: 'iap_purchase',
              flowId: resolved.flowId,
              versionId: resolved.versionId,
              experimentId: resolved.experimentId,
              variantId: resolved.variantId,
              stepId: pending.nodeId,
              properties,
            });
          }
        }
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
  }, [resolved, state, enqueueSdk, presenterRef, respondRef]);
};
