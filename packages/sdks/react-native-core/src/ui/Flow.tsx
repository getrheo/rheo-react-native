import { useEffect, type ReactNode } from 'react';
import { useFlow } from '../useFlow';
import {
  EmailPasswordAuthProvider,
  useEmailPasswordAuth,
  type EmailPasswordAuthHandlerPayload,
} from '../emailPasswordAuth';
import { OAuthLoginProvider, useOAuthLogin, type OAuthLoginHandlerPayload } from '../oauthLogin';
import type { FlowTerminalSnapshot } from '@getrheo/contracts';
import { resolveExternalSurfaceHostKey } from '@getrheo/contracts';
import { ActivityIndicator, View } from 'react-native';
import { LayerRenderer } from './LayerRenderer';
import { ScreenChrome } from './Screen';
import { DefaultResolveError } from './DefaultResolveError';
import type { ExternalSurfacesMap } from '../externalSurfaces/headless.js';

export type FlowProps = {
  channelId: string;
  theme?: 'light' | 'dark';
  /** Host-owned escape hatch when manifest resolve fails (full-bleed; no Rheo telemetry). */
  fallback?: ReactNode;
  /**
   * Host components keyed by `config.hostKey` (or node id when hostKey is unset).
   * Used when the flow lands on a `provider: 'headless'` surface.
   */
  externalSurfaces?: ExternalSurfacesMap;
  onFlowCompleted?: (payload: FlowTerminalSnapshot) => void;
  onFlowAbandoned?: (payload: FlowTerminalSnapshot) => void;
  includeManifestInTerminalPayload?: boolean;
  includePathInTerminalPayload?: boolean;
  includeAnswerDetailInTerminalPayload?: boolean;
  withGestureRoot?: boolean;
  locale?: string;
  onOAuthLogin?: (payload: OAuthLoginHandlerPayload) => void;
  onEmailPasswordAuth?: (payload: EmailPasswordAuthHandlerPayload) => void;
};

const FlowAuthHostBridge = ({
  onOAuthLogin,
  onEmailPasswordAuth,
  children,
}: {
  onOAuthLogin?: (payload: OAuthLoginHandlerPayload) => void;
  onEmailPasswordAuth?: (payload: EmailPasswordAuthHandlerPayload) => void;
  children: ReactNode;
}) => {
  const { attach: attachOAuth } = useOAuthLogin();
  const { attach: attachEmailPw } = useEmailPasswordAuth();

  useEffect(() => {
    if (!onOAuthLogin) return undefined;
    return attachOAuth(onOAuthLogin);
  }, [attachOAuth, onOAuthLogin]);

  useEffect(() => {
    if (!onEmailPasswordAuth) return undefined;
    return attachEmailPw(onEmailPasswordAuth);
  }, [attachEmailPw, onEmailPasswordAuth]);

  return <>{children}</>;
};

const FullBleedCenter = ({ children }: { children: ReactNode }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
);

export const Flow = ({
  channelId,
  theme = 'light',
  fallback = null,
  externalSurfaces,
  onFlowCompleted,
  onFlowAbandoned,
  includeManifestInTerminalPayload,
  includePathInTerminalPayload,
  includeAnswerDetailInTerminalPayload,
  withGestureRoot = true,
  locale = 'en',
  onOAuthLogin,
  onEmailPasswordAuth,
}: FlowProps) => {
  const {
    loading,
    resolveFailed,
    retry,
    screen,
    manifest,
    state,
    respond,
    reportExternalSurfaceOutcome,
    interpolationContext,
    relayNativeButtonAction,
    trackExternalLinkOpened,
    branding,
    mediaMap,
    pendingExternalSurface,
  } = useFlow({
    channelId,
    externalSurfaces,
    includeManifestInTerminalPayload,
    includePathInTerminalPayload,
    includeAnswerDetailInTerminalPayload,
    onFlowCompleted,
    onFlowAbandoned,
  });

  if (loading) {
    return (
      <FullBleedCenter>
        <ActivityIndicator />
      </FullBleedCenter>
    );
  }

  if (resolveFailed) {
    if (fallback != null) {
      return <>{fallback}</>;
    }
    return <DefaultResolveError theme={theme} onRetry={retry} />;
  }

  if (
    pendingExternalSurface &&
    pendingExternalSurface.config.provider === 'headless' &&
    state?.status === 'running'
  ) {
    const hostKey = resolveExternalSurfaceHostKey(pendingExternalSurface);
    const Host = externalSurfaces?.[hostKey];
    if (!Host) {
      // Missing registry entry is handled by useFlowExternalSurfaces (failed).
      return null;
    }
    return (
      <ScreenChrome theme={theme} withGestureRoot={withGestureRoot}>
        <Host
          surfaceId={hostKey}
          node={pendingExternalSurface}
          onComplete={() =>
            reportExternalSurfaceOutcome(pendingExternalSurface.id, 'completed', {
              provider: 'headless',
            })
          }
          onBack={() =>
            reportExternalSurfaceOutcome(pendingExternalSurface.id, 'back', {
              provider: 'headless',
            })
          }
          onDismiss={() =>
            reportExternalSurfaceOutcome(pendingExternalSurface.id, 'dismissed', {
              provider: 'headless',
            })
          }
        />
      </ScreenChrome>
    );
  }

  if (!manifest || !screen || !state || state.status !== 'running') {
    return null;
  }

  const flowBody = (
    <OAuthLoginProvider respond={respond}>
      <EmailPasswordAuthProvider respond={respond}>
        <FlowAuthHostBridge onOAuthLogin={onOAuthLogin} onEmailPasswordAuth={onEmailPasswordAuth}>
          <LayerRenderer
            manifest={manifest}
            screen={screen}
            locale={locale}
            theme={theme}
            mediaMap={mediaMap}
            branding={branding ?? undefined}
            interactive
            interpolationContext={interpolationContext}
            conditionalEval={{
              platform: state.session.platform,
              sdkAttributes: state.session.sdkAttributes,
              responses: state.responses,
            }}
            onRespond={respond}
            onAction={(a, meta) => {
              relayNativeButtonAction(a, meta);
            }}
            onHyperlinkOpened={trackExternalLinkOpened}
          />
        </FlowAuthHostBridge>
      </EmailPasswordAuthProvider>
    </OAuthLoginProvider>
  );

  return (
    <ScreenChrome theme={theme} withGestureRoot={withGestureRoot}>
      {flowBody}
    </ScreenChrome>
  );
};
