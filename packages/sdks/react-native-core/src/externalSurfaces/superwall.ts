import type {
  IapPurchaseEventProperties,
  NormalizedSurfaceOutcome,
  SuperwallSurfaceConfig,
} from '@getrheo/contracts';
import type { SurfaceSdkKeyPatch } from '@getrheo/flow-runtime';
import { getSdkLogger } from '../logging/sdkLogger';

/**
 * Commerce details extracted from Superwall after a successful purchase.
 * Fields are best-effort — when the host SDK omits product metadata,
 * individual fields may be missing.
 */
export type SuperwallPurchaseCommerce = Pick<
  IapPurchaseEventProperties,
  'product_id' | 'offering_id' | 'package_id' | 'price' | 'currency' | 'period_type'
>;

/**
 * Single resolution returned to the flow runtime. Adapters MUST emit exactly
 * one of these per `presentSuperwallPaywall` call so the runtime advances
 * the flow exactly once per pending surface.
 */
export type SuperwallPresentResult = {
  outcome: NormalizedSurfaceOutcome;
  sdkKeyPatch?: SurfaceSdkKeyPatch;
  /** Set when `outcome === 'purchase_completed'` and commerce metadata is available. */
  commerce?: SuperwallPurchaseCommerce;
};

/**
 * Indicates the host did not install a Superwall React Native package.
 * Distinct from a true `failed` outcome so callers can log a clearer message.
 */
export class SuperwallModuleMissingError extends Error {
  override readonly name = 'SuperwallModuleMissingError';
  constructor() {
    super(
      'Superwall is not installed. Install @superwall/react-native-superwall (or expo-superwall) in your host app and configure Superwall (Expo: expo-superwall/compat Superwall.configure) before adding a Superwall paywall step.',
    );
  }
}

type SuperwallDismissResult = {
  type?: string;
  productId?: string;
  product_id?: string;
};

type SuperwallSkipReason = {
  type?: string;
};

type SuperwallPaywallHandler = {
  onDismiss?: (
    info: unknown,
    result: SuperwallDismissResult | string | undefined,
  ) => void;
  onPresent?: (info: unknown) => void;
  onError?: (error: unknown) => void;
  onSkip?: (reason: SuperwallSkipReason | string | undefined) => void;
};

type SuperwallShared = {
  register?: (args: {
    placement: string;
    params?: Record<string, unknown>;
    handler?: SuperwallPaywallHandler;
    feature?: () => void;
  }) => Promise<unknown>;
  registerPlacement?: (
    placement: string,
    params?: Record<string, unknown>,
    handler?: SuperwallPaywallHandler,
  ) => Promise<unknown>;
};

type SuperwallModule = {
  Superwall?: { shared?: SuperwallShared };
  default?: { shared?: SuperwallShared } & SuperwallShared;
  shared?: SuperwallShared;
  register?: SuperwallShared['register'];
  registerPlacement?: SuperwallShared['registerPlacement'];
  PaywallPresentationHandler?: new () => SuperwallPaywallHandler;
};

const defaultLoader = (): SuperwallModule | null => {
  // Metro requires static string literals in require(); try each host package in turn.
  // Expo: `expo-superwall/compat` exposes the imperative Superwall.shared.register API
  // that presentSuperwallPaywall uses (the main hooks entry does not).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@superwall/react-native-superwall') as SuperwallModule;
    if (mod) return mod;
  } catch {
    // try Expo Superwall
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-superwall/compat') as SuperwallModule;
    if (mod) return mod;
  } catch {
    // try older / alternate Expo entry
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-superwall') as SuperwallModule;
    if (mod) return mod;
  } catch {
    // not installed
  }
  return null;
};

let swModuleLoader: () => SuperwallModule | null = defaultLoader;

/** Test seam: override the Superwall module lookup. Pass `null` to simulate a missing host install. */
export const __setSuperwallModuleForTests = (mod: SuperwallModule | null): (() => void) => {
  const prev = swModuleLoader;
  swModuleLoader = () => mod;
  return () => {
    swModuleLoader = prev;
  };
};

const resolveShared = (mod: SuperwallModule): SuperwallShared | null => {
  if (mod.Superwall?.shared) return mod.Superwall.shared;
  if (mod.default?.shared) return mod.default.shared;
  if (mod.shared) return mod.shared;
  if (typeof mod.register === 'function' || typeof mod.registerPlacement === 'function') {
    return mod;
  }
  if (
    mod.default &&
    (typeof mod.default.register === 'function' ||
      typeof mod.default.registerPlacement === 'function')
  ) {
    return mod.default;
  }
  return null;
};

const dismissType = (raw: SuperwallDismissResult | string | undefined): string => {
  if (typeof raw === 'string') return raw.toLowerCase();
  if (raw && typeof raw.type === 'string') return raw.type.toLowerCase();
  return '';
};

const productIdFromDismiss = (
  raw: SuperwallDismissResult | string | undefined,
): string | undefined => {
  if (!raw || typeof raw === 'string') return undefined;
  if (typeof raw.productId === 'string' && raw.productId.length > 0) return raw.productId;
  if (typeof raw.product_id === 'string' && raw.product_id.length > 0) return raw.product_id;
  return undefined;
};

/**
 * Map Superwall dismiss / skip / error signals to Rheo normalized outcomes.
 */
export const normalizeSuperwallResult = (input: {
  kind: 'dismiss' | 'skip' | 'error' | 'feature';
  dismiss?: SuperwallDismissResult | string;
  skip?: SuperwallSkipReason | string;
}): SuperwallPresentResult => {
  if (input.kind === 'error') {
    return {
      outcome: 'failed',
      sdkKeyPatch: { onb_sw_last_event: 'failed' },
    };
  }
  if (input.kind === 'feature') {
    // Feature unlocked without a purchase event (already entitled / holdout feature path).
    return {
      outcome: 'dismissed',
      sdkKeyPatch: { onb_sw_last_event: 'dismissed' },
    };
  }
  if (input.kind === 'skip') {
    return {
      outcome: 'dismissed',
      sdkKeyPatch: { onb_sw_last_event: 'dismissed' },
    };
  }

  const type = dismissType(input.dismiss);
  if (type === 'purchased' || type === 'purchase' || type === 'purchase_completed') {
    const productId = productIdFromDismiss(input.dismiss);
    const commerce: SuperwallPurchaseCommerce | undefined = productId
      ? { product_id: productId }
      : undefined;
    const extra: SurfaceSdkKeyPatch = {};
    if (productId) extra.onb_sw_last_product_id = productId;
    return {
      outcome: 'purchase_completed',
      sdkKeyPatch: { onb_sw_last_event: 'purchase_completed', ...extra },
      ...(commerce ? { commerce } : {}),
    };
  }
  if (type === 'restored' || type === 'restore' || type === 'restore_completed') {
    return {
      outcome: 'restore_completed',
      sdkKeyPatch: { onb_sw_last_event: 'restore_completed' },
    };
  }
  if (type === 'declined' || type === 'cancelled' || type === 'canceled' || type === 'purchase_cancelled') {
    return {
      outcome: 'purchase_cancelled',
      sdkKeyPatch: { onb_sw_last_event: 'purchase_cancelled' },
    };
  }
  // Closed / unknown dismiss → dismissed (Fallback still covers unmapped outcomes).
  return {
    outcome: 'dismissed',
    sdkKeyPatch: { onb_sw_last_event: 'dismissed' },
  };
};

const createHandler = (
  Mod: SuperwallModule,
  settle: (result: SuperwallPresentResult) => void,
): SuperwallPaywallHandler => {
  const HandlerCtor = Mod.PaywallPresentationHandler;
  const handler: SuperwallPaywallHandler = HandlerCtor ? new HandlerCtor() : {};
  let settled = false;
  const once = (result: SuperwallPresentResult) => {
    if (settled) return;
    settled = true;
    settle(result);
  };

  const onDismiss = (info: unknown, result: SuperwallDismissResult | string | undefined) => {
    void info;
    once(normalizeSuperwallResult({ kind: 'dismiss', dismiss: result }));
  };
  const onError = (error: unknown) => {
    getSdkLogger().warn('[rheo] Superwall paywall error:', error);
    once(normalizeSuperwallResult({ kind: 'error' }));
  };
  const onSkip = (reason: SuperwallSkipReason | string | undefined) => {
    once(normalizeSuperwallResult({ kind: 'skip', skip: reason }));
  };

  handler.onDismiss = onDismiss;
  handler.onError = onError;
  handler.onSkip = onSkip;
  return handler;
};

/**
 * Present a Superwall placement and resolve to a normalized outcome.
 *
 * The host installs and configures Superwall; this function never configures
 * the SDK. If no Superwall module is installed it resolves to `failed` so
 * authors' fallback edge still runs.
 */
export const presentSuperwallPaywall = async (
  config: SuperwallSurfaceConfig,
): Promise<SuperwallPresentResult> => {
  const placementId = config.placementId?.trim() ?? '';
  const baseKeyPatch: SurfaceSdkKeyPatch = {
    ...(placementId ? { onb_sw_last_placement_id: placementId } : {}),
  };

  if (!placementId) {
    getSdkLogger().warn('[rheo] Superwall surface is missing placementId');
    return {
      outcome: 'failed',
      sdkKeyPatch: { ...baseKeyPatch, onb_sw_last_event: 'failed' },
    };
  }

  const mod = swModuleLoader();
  if (!mod) {
    const err = new SuperwallModuleMissingError();
    getSdkLogger().warn(`[rheo] ${err.message}`);
    return {
      outcome: 'failed',
      sdkKeyPatch: { ...baseKeyPatch, onb_sw_last_event: 'failed' },
    };
  }

  const shared = resolveShared(mod);
  if (!shared) {
    getSdkLogger().warn('[rheo] Superwall module loaded but no register API was found');
    return {
      outcome: 'failed',
      sdkKeyPatch: { ...baseKeyPatch, onb_sw_last_event: 'failed' },
    };
  }

  try {
    const result = await new Promise<SuperwallPresentResult>((resolve, reject) => {
      let settled = false;
      const settle = (value: SuperwallPresentResult) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const handler = createHandler(mod, settle);
      const feature = () => {
        // Called when the user already has access (or purchase unlocked the feature).
        // Prefer dismiss/purchase callbacks when they fire; otherwise treat as dismissed.
        settle(normalizeSuperwallResult({ kind: 'feature' }));
      };

      const run = async () => {
        if (typeof shared.register === 'function') {
          await shared.register({
            placement: placementId,
            handler,
            feature,
          });
          return;
        }
        if (typeof shared.registerPlacement === 'function') {
          await shared.registerPlacement(placementId, undefined, handler);
          return;
        }
        throw new Error('Superwall register API missing');
      };

      void run()
        .then(() => {
          // Some Superwall builds resolve register before dismiss callbacks.
          // Give handlers a turn; if nothing settled, treat as dismissed (skip/holdout).
          queueMicrotask(() => {
            if (!settled) {
              settle(normalizeSuperwallResult({ kind: 'skip' }));
            }
          });
        })
        .catch(reject);
    });

    return {
      outcome: result.outcome,
      sdkKeyPatch: { ...baseKeyPatch, ...(result.sdkKeyPatch ?? {}) },
      ...(result.commerce ? { commerce: result.commerce } : {}),
    };
  } catch (err) {
    getSdkLogger().warn('[rheo] Superwall paywall failed:', err);
    return {
      outcome: 'failed',
      sdkKeyPatch: { ...baseKeyPatch, onb_sw_last_event: 'failed' },
    };
  }
};
