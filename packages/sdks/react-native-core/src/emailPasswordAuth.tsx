import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import type {ReactNode} from 'react';
import type { EmailPasswordAuthMode, FlowManifest } from '@getrheo/contracts';
import type {StepResponse} from '@getrheo/flow-runtime';

export type EmailPasswordAuthResolveInput = {
  success: boolean;
  error?: unknown;
};

export type EmailPasswordAuthHandlerPayload = {
  manifest: FlowManifest;
  screenId: string;
  layerId: string;
  fieldKey: string;
  mode: EmailPasswordAuthMode;
  email: string;
  password: string;
  confirmPassword?: string;
  resolve: (r: EmailPasswordAuthResolveInput) => void;
};

type EmailPasswordHandler = (payload: EmailPasswordAuthHandlerPayload) => void;

export type EmailPasswordAuthSubmitPayload = {
  manifest: FlowManifest;
  screenId: string;
  layerId: string;
  fieldKey: string;
  mode: EmailPasswordAuthMode;
  email: string;
  password: string;
  confirmPassword?: string;
  onSettled?: () => void;
};

type CtxValue = {
  attach: (handler: EmailPasswordHandler) => () => void;
  dispatchSubmit: (p: EmailPasswordAuthSubmitPayload) => void;
};

const EmailPasswordAuthCtx = createContext<CtxValue | null>(null);

export type EmailPasswordAuthProviderProps = {
  respond: (r: StepResponse) => void;
  children: ReactNode;
};

/**
 * Hosts attach `handler` to run email/password authentication (sign-in API, sign-up, etc.).
 * When no handler is attached, successful client-side validation auto-responds with `success: true`
 * so flows and the simulator advance without extra wiring.
 */
export const EmailPasswordAuthProvider = ({
  respond,
  children,
}: EmailPasswordAuthProviderProps) => {
  const handlerRef = useRef<EmailPasswordHandler | null>(null);

  const attach = useCallback((handler: EmailPasswordHandler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) handlerRef.current = null;
    };
  }, []);

  const dispatchSubmit = useCallback(
    (p: EmailPasswordAuthSubmitPayload): void => {
      const finalize = (r: EmailPasswordAuthResolveInput): void => {
        respond({
          kind: 'email_password_auth_resolve',
          layerId: p.layerId,
          fieldKey: p.fieldKey,
          mode: p.mode,
          email: p.email.trim(),
          password: p.password,
          confirmPassword: p.confirmPassword,
          success: r.success,
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
          fieldKey: p.fieldKey,
          mode: p.mode,
          email: p.email,
          password: p.password,
          confirmPassword: p.confirmPassword,
          resolve: finalize,
        });
      } else {
        finalize({ success: true });
      }
    },
    [respond],
  );

  const value = useMemo<CtxValue>(
    () => ({
      attach,
      dispatchSubmit,
    }),
    [attach, dispatchSubmit],
  );

  return <EmailPasswordAuthCtx.Provider value={value}>{children}</EmailPasswordAuthCtx.Provider>;
};

export const useEmailPasswordAuth = (): {
  attach: (handler: EmailPasswordHandler) => () => void;
} => {
  const ctx = useContext(EmailPasswordAuthCtx);
  if (!ctx) {
    throw new Error('useEmailPasswordAuth must be used inside <EmailPasswordAuthProvider>');
  }
  return { attach: ctx.attach };
};

/** @internal — native renderer only */
export const useEmailPasswordAuthDispatch = (): CtxValue['dispatchSubmit'] | undefined =>
  useContext(EmailPasswordAuthCtx)?.dispatchSubmit;
