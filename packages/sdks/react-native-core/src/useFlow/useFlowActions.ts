import { useCallback, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { abandonFlow, findExternalSurface, type FlowState } from '@getrheo/flow-runtime';
import { parseHyperlinkHref, type AppReviewOutcome, type ButtonAction, type ExternalSurfaceNode, type PermissionOutcome } from '@getrheo/contracts';
import type { SdkResolveResponse } from '@getrheo/contracts';
import { runBuiltInAppReviewIfAvailable } from '../review/builtInAppReviewRegistry.js';
import { runBuiltInOsPermissionIfAvailable } from '../permissions/builtInPermissionRegistry.js';
import type { EnqueueSdkFn } from './inputCaptureAnalytics.js';
import type { NativeButtonActionMeta } from './nativeButtonActionMeta.js';

export type UseFlowActionsParams = {
  stateRef: MutableRefObject<FlowState | null>;
  resolvedRef: MutableRefObject<SdkResolveResponse | null>;
  flowEmitChannelRef: MutableRefObject<string>;
  respondRef: MutableRefObject<(r: import('@getrheo/flow-runtime').StepResponse) => void>;
  enqueueSdk: EnqueueSdkFn;
  resolved: SdkResolveResponse | null;
  state: FlowState | null;
  setState: Dispatch<SetStateAction<FlowState | null>>;
};

export const useFlowActions = ({
  stateRef,
  resolvedRef,
  flowEmitChannelRef,
  respondRef,
  enqueueSdk,
  resolved,
  state,
  setState,
}: UseFlowActionsParams) => {
  const abandon = useCallback(() => {
    const prev = stateRef.current;
    const data = resolvedRef.current;
    const ch = flowEmitChannelRef.current;
    if (!prev || !data || !ch) return;
    if (prev.status !== 'running') return;
    enqueueSdk({
      name: 'flow_abandoned',
      flowId: data.flowId,
      versionId: data.versionId,
      experimentId: data.experimentId,
      variantId: data.variantId,
      stepId: prev.currentScreenId,
    });
    const next = abandonFlow(prev);
    setState(next);
    stateRef.current = next;
  }, [enqueueSdk, flowEmitChannelRef, resolvedRef, setState, stateRef]);

  const relayNativeButtonAction = useCallback(
    (action: ButtonAction, meta?: NativeButtonActionMeta): void => {
      const prev = stateRef.current;
      const data = resolvedRef.current;
      const screenId = prev?.currentScreenId;
      const layerId = meta?.layerId;
      if (!prev || !data || !screenId || !layerId) return;

      if (action.kind === 'request_os_permission') {
        const finalize = (outcome: PermissionOutcome): void => {
          respondRef.current({
            kind: 'permission_outcome',
            layerId,
            permissionKey: action.permissionKey,
            outcome,
          });
        };

        void runBuiltInOsPermissionIfAvailable(action.permissionKey, prev.session.platform)
          .then(finalize)
          .catch(() => finalize('denied'));
        return;
      }

      if (action.kind !== 'request_app_review') return;

      const emitReviewEvent = (name: 'app_review_prompt_shown' | 'app_review_prompt_dismissed'): void => {
        enqueueSdk({
          name,
          flowId: data.flowId,
          versionId: data.versionId,
          experimentId: data.experimentId,
          variantId: data.variantId,
          stepId: screenId,
          properties: { layer_id: layerId },
        });
      };

      const finalizeReview = (outcome: AppReviewOutcome): void => {
        const checkboxValues = meta?.screenCommit?.checkboxValues ?? {};
        const capturedDraft = meta?.screenCommit?.capturedDraft;
        respondRef.current({
          kind: 'screen_commit',
          primary: { kind: 'app_review_outcome', layerId, outcome },
          checkboxValues,
          ...(capturedDraft ? { capturedDraft } : {}),
        });
      };

      void runBuiltInAppReviewIfAvailable(prev.session.platform)
        .then((result) => {
          if (result.shown) {
            emitReviewEvent('app_review_prompt_shown');
            emitReviewEvent('app_review_prompt_dismissed');
            finalizeReview('dismissed');
          } else {
            finalizeReview('not_shown');
          }
        })
        .catch(() => finalizeReview('not_shown'));
    },
    [enqueueSdk, respondRef, resolvedRef, stateRef],
  );

  const trackExternalLinkOpened = useCallback(
    (meta: { layerId: string; href: string }): void => {
      const data = resolvedRef.current;
      const st = stateRef.current;
      if (!data || !st?.currentScreenId) return;
      const parsed = parseHyperlinkHref(meta.href.trim());
      if (!parsed.ok) return;
      const properties: Record<string, string | number | boolean | null | string[]> = {
        layerId: meta.layerId,
        hrefScheme: parsed.scheme,
      };
      if (parsed.scheme === 'https') properties.linkHost = parsed.host;
      enqueueSdk({
        name: 'external_link_opened',
        flowId: data.flowId,
        versionId: data.versionId,
        experimentId: data.experimentId,
        variantId: data.variantId,
        stepId: st.currentScreenId,
        properties,
      });
    },
    [enqueueSdk, resolvedRef, stateRef],
  );

  const pendingExternalSurface = useMemo<ExternalSurfaceNode | null>(() => {
    if (!resolved?.manifest || !state?.pendingExternalSurface) return null;
    return findExternalSurface(resolved.manifest, state.pendingExternalSurface.nodeId) ?? null;
  }, [resolved?.manifest, state?.pendingExternalSurface]);

  return { abandon, relayNativeButtonAction, trackExternalLinkOpened, pendingExternalSurface };
};
