import { Branding } from '@getrheo/contracts/branding';
import type { ButtonAction, ExternalSurfaceNode, FlowManifest, FlowTerminalSnapshot, Screen } from '@getrheo/contracts';
import type { FlowState, InterpolationContext, StepResponse } from '@getrheo/flow-runtime';
import type { RevenueCatPresentResult } from '../externalSurfaces/revenueCat.js';
import { presentRevenueCatPaywall } from '../externalSurfaces/revenueCat.js';

export type UseFlowResult = {
  loading: boolean;
  error: Error | null;
  /** True when resolve failed and no manifest was loaded (`!loading && error && !manifest`). */
  resolveFailed: boolean;
  /** Re-runs `POST /v1/sdk/resolve` (shows loading spinner while in flight). */
  retry: () => void;
  state: FlowState | null;
  screen: Screen | undefined;
  manifest: FlowManifest | null;
  pendingExternalSurface: ExternalSurfaceNode | null;
  flowId: string | null;
  versionId: string | null;
  variantId: string | null;
  branding: Branding | null;
  /** CDN URLs for image/lottie layers from `/v1/sdk/resolve`; pass to `LayerRenderer`. */
  mediaMap: Record<string, string>;
  respond: (r: StepResponse) => void;
  interpolationContext: InterpolationContext | undefined;
  relayNativeButtonAction: (
    action: ButtonAction,
    meta?: import('./nativeButtonActionMeta.js').NativeButtonActionMeta,
  ) => void;
  trackExternalLinkOpened: (meta: { layerId: string; href: string }) => void;
  abandon: () => void;
};

export type ExternalSurfacePresenter = (
  node: ExternalSurfaceNode,
) => Promise<RevenueCatPresentResult>;

export type UseFlowOptions = {
  channelId: string;
  externalSurfacePresenter?: ExternalSurfacePresenter;
  includeManifestInTerminalPayload?: boolean;
  includePathInTerminalPayload?: boolean;
  includeAnswerDetailInTerminalPayload?: boolean;
  onFlowCompleted?: (payload: FlowTerminalSnapshot) => void;
  onFlowAbandoned?: (payload: FlowTerminalSnapshot) => void;
};

export const defaultExternalSurfacePresenter: ExternalSurfacePresenter = (node) => {
  if (node.config.provider === 'revenuecat') {
    return presentRevenueCatPaywall(node.config);
  }
  if (node.config.provider === 'unspecified') {
    return Promise.resolve({
      outcome: 'failed' as const,
      sdkKeyPatch: { onb_rc_last_event: 'failed' },
    });
  }
  return Promise.resolve({
    outcome: 'failed' as const,
    sdkKeyPatch: { onb_rc_last_event: 'failed' },
  });
};
