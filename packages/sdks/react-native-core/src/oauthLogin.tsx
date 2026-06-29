import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {ReactNode} from 'react';
import type { FlowManifest, OAuthLoginProvider as ManifestOAuthLoginProvider } from '@getrheo/contracts';
import type {StepResponse} from '@getrheo/flow-runtime';

export type OAuthLoginResolveInput = {
  success: boolean;
  customerExternalId?: string;
  error?: unknown;
};

export type OAuthLoginHandlerPayload = {
  manifest: FlowManifest;
  screenId: string;
  layerId: string;
  provider: ManifestOAuthLoginProvider;
  resolve: (r: OAuthLoginResolveInput) => void;
};

type OAuthHandler = (payload: OAuthLoginHandlerPayload) => void;

export type OAuthLoginTapPayload = {
  manifest: FlowManifest;
  screenId: string;
  layerId: string;
  provider: ManifestOAuthLoginProvider;
  onSettled?: () => void;
};

type CtxValue = {
  authenticated: boolean;
  setAuthenticated: (v: boolean) => void;
  attach: (handler: OAuthHandler) => () => void;
  dispatchTap: (p: OAuthLoginTapPayload) => void;
};

const OAuthLoginCtx = createContext<CtxValue | null>(null);

export type OAuthLoginProviderProps = {
  respond: (r: StepResponse) => void;
  children: ReactNode;
};

export const OAuthLoginProvider = ({ respond, children }: OAuthLoginProviderProps) => {
  const handlerRef = useRef<OAuthHandler | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  const attach = useCallback((handler: OAuthHandler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) handlerRef.current = null;
    };
  }, []);

  const dispatchTap = useCallback(
    (p: OAuthLoginTapPayload): void => {
      const finalize = (r: OAuthLoginResolveInput): void => {
        respond({
          kind: 'oauth_login_resolve',
          layerId: p.layerId,
          provider: p.provider,
          success: r.success,
          customerExternalId: r.customerExternalId,
          error: r.error,
        });
        p.onSettled?.();
      };
      const h = handlerRef.current;
      if (h) {
        h({
          manifest: p.manifest,
          screenId: p.screenId,
          layerId: p.layerId,
          provider: p.provider,
          resolve: finalize,
        });
      } else {
        finalize({ success: false });
      }
    },
    [respond],
  );

  const value = useMemo<CtxValue>(
    () => ({
      authenticated,
      setAuthenticated,
      attach,
      dispatchTap,
    }),
    [authenticated, attach, dispatchTap],
  );

  return <OAuthLoginCtx.Provider value={value}>{children}</OAuthLoginCtx.Provider>;
};

export const useOAuthLogin = (): {
  attach: (handler: OAuthHandler) => () => void;
  setAuthenticated: (v: boolean) => void;
  authenticated: boolean;
} => {
  const ctx = useContext(OAuthLoginCtx);
  if (!ctx) {
    throw new Error('useOAuthLogin must be used inside <OAuthLoginProvider>');
  }
  return {
    attach: ctx.attach,
    setAuthenticated: ctx.setAuthenticated,
    authenticated: ctx.authenticated,
  };
};

/** @internal — native renderer only */
export const useOAuthLoginDispatch = (): CtxValue['dispatchTap'] | undefined =>
  useContext(OAuthLoginCtx)?.dispatchTap;

/** Optional read of presentation flag (outside provider returns `undefined`). */
export const useOAuthLoginOptional = (): boolean | undefined => useContext(OAuthLoginCtx)?.authenticated;
