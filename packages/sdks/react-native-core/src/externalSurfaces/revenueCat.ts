import type { IapPurchaseEventProperties, NormalizedSurfaceOutcome, RevenueCatSurfaceConfig } from '@getrheo/contracts';
import type { SurfaceSdkKeyPatch } from '@getrheo/flow-runtime';

/**
 * Commerce details extracted from RevenueCat after a successful purchase. The
 * SDK forwards these to the `iap_purchase` analytics event so dashboards can
 * report revenue, product, and offering without calling RC server APIs.
 *
 * Fields are best-effort — when RC's APIs are unavailable or the host's RC
 * version omits price metadata, individual fields may be missing. The
 * `iap_purchase` event still fires with the fields we have.
 */
export type RevenueCatPurchaseCommerce = Pick<
  IapPurchaseEventProperties,
  'product_id' | 'offering_id' | 'package_id' | 'price' | 'currency' | 'period_type'
>;

/**
 * Single resolution returned to the flow runtime. Adapters MUST emit exactly
 * one of these per `presentRevenueCatPaywall` call so the runtime advances
 * the flow exactly once per pending surface.
 */
export type RevenueCatPresentResult = {
  outcome: NormalizedSurfaceOutcome;
  sdkKeyPatch?: SurfaceSdkKeyPatch;
  /** Set when `outcome === 'purchase_completed'` and the SDK was able to read commerce metadata from RC. */
  commerce?: RevenueCatPurchaseCommerce;
};

/**
 * Indicates the host did not install `react-native-purchases-ui`. Distinct
 * from a true `failed` outcome so callers can log a clearer message.
 */
export class RevenueCatModuleMissingError extends Error {
  override readonly name = 'RevenueCatModuleMissingError';
  constructor() {
    super(
      'react-native-purchases-ui is not installed. Install it in your host app and call Purchases.configure() before adding a RevenueCat paywall step.',
    );
  }
}

type RcPresentOpts = {
  offering?: { identifier?: string } | undefined;
  displayCloseButton?: boolean;
};

type RcModule = {
  presentPaywall?: (opts?: RcPresentOpts) => Promise<unknown>;
  presentPaywallIfNeeded?: (opts: {
    requiredEntitlementIdentifier?: string;
    offering?: { identifier?: string } | undefined;
    displayCloseButton?: boolean;
  }) => Promise<unknown>;
};

const defaultLoader = (): RcModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases-ui') as { default?: RcModule } & RcModule;
    // Some bundlers (Babel/esbuild) wrap into `{ default: ... }`.
    return (mod && (mod.default ?? mod)) as RcModule;
  } catch {
    return null;
  }
};

let rcModuleLoader: () => RcModule | null = defaultLoader;

/** Test seam: override the RC module lookup. Pass `null` to simulate a missing host install. */
export const __setRevenueCatModuleForTests = (mod: RcModule | null): (() => void) => {
  const prev = rcModuleLoader;
  rcModuleLoader = () => mod;
  return () => {
    rcModuleLoader = prev;
  };
};

/**
 * Minimal `react-native-purchases` surface we read from for commerce
 * enrichment. We narrow to just what we need so different RC versions stay
 * compatible — fields we cannot find resolve to `undefined`.
 */
type RcStoreProduct = {
  identifier?: string;
  price?: number;
  priceString?: string;
  currencyCode?: string;
  introPrice?: unknown;
};

type RcPackage = {
  identifier?: string;
  product?: RcStoreProduct;
  storeProduct?: RcStoreProduct;
};

type RcOffering = {
  identifier?: string;
  availablePackages?: RcPackage[];
};

type RcStoreTransaction = {
  productIdentifier?: string;
  purchaseDate?: string;
  purchaseDateMillis?: number;
};

type RcEntitlementInfo = {
  productIdentifier?: string;
  periodType?: string;
  latestPurchaseDate?: string;
  latestPurchaseDateMillis?: number;
};

type RcCustomerInfo = {
  entitlements?: {
    active?: Record<string, RcEntitlementInfo | undefined>;
  };
  activeSubscriptions?: string[];
  allPurchaseDates?: Record<string, string | undefined>;
  allPurchaseDatesMillis?: Record<string, number | undefined>;
  nonSubscriptionTransactions?: RcStoreTransaction[];
};

type RcPurchasesModule = {
  getCustomerInfo?: () => Promise<RcCustomerInfo | null | undefined>;
  getOfferings?: () => Promise<
    | {
        current?: RcOffering | null;
        all?: Record<string, RcOffering | undefined>;
      }
    | null
    | undefined
  >;
};

const defaultPurchasesLoader = (): RcPurchasesModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases') as
      | { default?: RcPurchasesModule }
      | RcPurchasesModule;
    const candidate =
      (mod as { default?: RcPurchasesModule }).default ?? (mod as RcPurchasesModule);
    return candidate ?? null;
  } catch {
    return null;
  }
};

let rcPurchasesLoader: () => RcPurchasesModule | null = defaultPurchasesLoader;

/** Test seam: override the `react-native-purchases` module lookup. */
export const __setRevenueCatPurchasesModuleForTests = (
  mod: RcPurchasesModule | null,
): (() => void) => {
  const prev = rcPurchasesLoader;
  rcPurchasesLoader = () => mod;
  return () => {
    rcPurchasesLoader = prev;
  };
};

const normalizePeriodType = (raw: unknown): RevenueCatPurchaseCommerce['period_type'] => {
  if (typeof raw !== 'string') return undefined;
  const v = raw.toUpperCase();
  if (v === 'NORMAL') return 'normal';
  if (v === 'INTRO' || v === 'INTROFFER' || v === 'INTRO_OFFER') return 'intro';
  if (v === 'TRIAL' || v === 'FREE_TRIAL') return 'trial';
  return undefined;
};

const productFromPackage = (pkg: RcPackage | undefined): RcStoreProduct | undefined =>
  pkg?.storeProduct ?? pkg?.product;

const pickRecentProductId = (info: RcCustomerInfo): string | undefined => {
  const entitlements = info.entitlements?.active ?? {};
  let bestProductId: string | undefined;
  let bestMillis = -Infinity;
  for (const ent of Object.values(entitlements)) {
    if (!ent?.productIdentifier) continue;
    const millis =
      typeof ent.latestPurchaseDateMillis === 'number'
        ? ent.latestPurchaseDateMillis
        : ent.latestPurchaseDate
          ? Date.parse(ent.latestPurchaseDate)
          : 0;
    if (millis > bestMillis) {
      bestMillis = millis;
      bestProductId = ent.productIdentifier;
    }
  }
  if (bestProductId) return bestProductId;
  const subs = info.activeSubscriptions;
  if (Array.isArray(subs) && subs.length > 0) {
    return subs[subs.length - 1];
  }
  const nonSub = info.nonSubscriptionTransactions;
  if (Array.isArray(nonSub) && nonSub.length > 0) {
    const latest = nonSub[nonSub.length - 1];
    if (latest?.productIdentifier) return latest.productIdentifier;
  }
  return undefined;
};

const findPackageForProduct = (
  offering: RcOffering | null | undefined,
  productId: string,
): { offering: RcOffering; pkg: RcPackage } | undefined => {
  if (!offering?.availablePackages) return undefined;
  for (const pkg of offering.availablePackages) {
    const product = productFromPackage(pkg);
    if (product?.identifier === productId) {
      return { offering, pkg };
    }
  }
  return undefined;
};

/**
 * Read commerce details from RevenueCat after a successful purchase. The
 * flow always advances on `purchase_completed`, even if this lookup fails —
 * missing fields are simply absent from the analytics event.
 */
export const extractRevenueCatPurchaseCommerce = async (
  config: RevenueCatSurfaceConfig,
): Promise<RevenueCatPurchaseCommerce | undefined> => {
  const purchases = rcPurchasesLoader();
  if (!purchases || typeof purchases.getCustomerInfo !== 'function') {
    return undefined;
  }
  let info: RcCustomerInfo | null | undefined;
  try {
    info = await purchases.getCustomerInfo();
  } catch (err) {
     
    console.warn('[rheo] RevenueCat getCustomerInfo failed:', err);
    return undefined;
  }
  if (!info) return undefined;

  const productId = pickRecentProductId(info);
  if (!productId) {
    // Without a product id we can't emit a valid `iap_purchase` event.
    // The flow still advances on `purchase_completed`; we just skip
    // commerce analytics for this purchase.
    return undefined;
  }

  const commerce: RevenueCatPurchaseCommerce = { product_id: productId };
  if (config.offeringId) commerce.offering_id = config.offeringId;

  const activeEntitlement = Object.values(info.entitlements?.active ?? {}).find(
    (ent) => ent?.productIdentifier === productId,
  );
  const periodType = normalizePeriodType(activeEntitlement?.periodType);
  if (periodType) commerce.period_type = periodType;

  if (typeof purchases.getOfferings === 'function') {
    try {
      const offerings = await purchases.getOfferings();
      const candidates: Array<RcOffering | null | undefined> = [];
      if (config.offeringId && offerings?.all?.[config.offeringId]) {
        candidates.push(offerings.all[config.offeringId]);
      }
      if (offerings?.current) candidates.push(offerings.current);
      for (const off of Object.values(offerings?.all ?? {})) {
        if (off && !candidates.includes(off)) candidates.push(off);
      }
      for (const off of candidates) {
        const match = findPackageForProduct(off, productId);
        if (!match) continue;
        const product = productFromPackage(match.pkg);
        if (match.pkg.identifier) commerce.package_id = match.pkg.identifier;
        if (!commerce.offering_id && match.offering.identifier) {
          commerce.offering_id = match.offering.identifier;
        }
        if (product) {
          if (typeof product.price === 'number' && product.price >= 0) {
            commerce.price = product.price;
          }
          if (typeof product.currencyCode === 'string' && product.currencyCode.length === 3) {
            commerce.currency = product.currencyCode.toUpperCase();
          }
        }
        break;
      }
    } catch (err) {
       
      console.warn('[rheo] RevenueCat getOfferings failed:', err);
    }
  }

  // Price + currency must travel together (contract).
  if (commerce.price === undefined || commerce.currency === undefined) {
    delete commerce.price;
    delete commerce.currency;
  }

  return commerce;
};

/**
 * Map RC's `PaywallResult` constants to Rheo normalized outcomes. The
 * RC types live in the host's installed version, so we accept a `string`
 * and match by value.
 */
export const normalizeRcPaywallResult = (raw: unknown): RevenueCatPresentResult => {
  const value = typeof raw === 'string' ? raw.toUpperCase() : '';
  switch (value) {
    case 'PURCHASED':
      return {
        outcome: 'purchase_completed',
        sdkKeyPatch: { onb_rc_last_event: 'purchase_completed' },
      };
    case 'RESTORED':
      return {
        outcome: 'restore_completed',
        sdkKeyPatch: { onb_rc_last_event: 'restore_completed' },
      };
    case 'CANCELLED':
      return {
        outcome: 'purchase_cancelled',
        sdkKeyPatch: { onb_rc_last_event: 'purchase_cancelled' },
      };
    case 'NOT_PRESENTED':
      return {
        outcome: 'dismissed',
        sdkKeyPatch: { onb_rc_last_event: 'dismissed' },
      };
    case 'ERROR':
      return {
        outcome: 'failed',
        sdkKeyPatch: { onb_rc_last_event: 'failed' },
      };
    default:
      // Unknown values land on `failed` so authors' fallback edge handles them.
      return {
        outcome: 'failed',
        sdkKeyPatch: { onb_rc_last_event: 'failed' },
      };
  }
};

/**
 * Present the RevenueCat paywall and resolve to a normalized outcome.
 *
 * The host installs and configures `Purchases`; this function never calls
 * `Purchases.configure`. If the optional UI module isn't installed it
 * resolves to `failed` so authors' fallback edge still runs.
 */
export const presentRevenueCatPaywall = async (
  config: RevenueCatSurfaceConfig,
): Promise<RevenueCatPresentResult> => {
  const mod = rcModuleLoader();
  const baseKeyPatch: SurfaceSdkKeyPatch = {
    ...(config.offeringId ? { onb_rc_last_offering_id: config.offeringId } : {}),
  };

  if (!mod) {
    const err = new RevenueCatModuleMissingError();
    // We deliberately do not throw — the runtime advances on `failed` so
    // a missing host integration doesn't permanently stall the flow.
     
    console.warn(`[rheo] ${err.message}`);
    return {
      outcome: 'failed',
      sdkKeyPatch: { ...baseKeyPatch, onb_rc_last_event: 'failed' },
    };
  }

  const offeringOpts = config.offeringId ? { identifier: config.offeringId } : undefined;
  const presentOpts: RcPresentOpts = {
    ...(offeringOpts ? { offering: offeringOpts } : {}),
  };

  try {
    let raw: unknown;
    if (
      config.presentation === 'paywall_if_needed' &&
      typeof mod.presentPaywallIfNeeded === 'function'
    ) {
      raw = await mod.presentPaywallIfNeeded({
        // RC requires a required entitlement id for `presentPaywallIfNeeded`;
        // fall back to a sensible default when authors don't specify one.
        requiredEntitlementIdentifier: config.offeringId ?? 'pro',
        offering: offeringOpts,
      });
    } else if (typeof mod.presentPaywall === 'function') {
      raw = await mod.presentPaywall(
        Object.keys(presentOpts).length > 0 ? presentOpts : undefined,
      );
    } else {
      return {
        outcome: 'failed',
        sdkKeyPatch: { ...baseKeyPatch, onb_rc_last_event: 'failed' },
      };
    }
    const normalized = normalizeRcPaywallResult(raw);
    if (normalized.outcome === 'purchase_completed') {
      const commerce = await extractRevenueCatPurchaseCommerce(config);
      const extraKeyPatch: SurfaceSdkKeyPatch = {};
      if (commerce?.product_id) extraKeyPatch.onb_rc_last_product_id = commerce.product_id;
      if (commerce?.period_type) extraKeyPatch.onb_rc_last_period_type = commerce.period_type;
      return {
        outcome: normalized.outcome,
        sdkKeyPatch: {
          ...baseKeyPatch,
          ...(normalized.sdkKeyPatch ?? {}),
          ...extraKeyPatch,
        },
        ...(commerce ? { commerce } : {}),
      };
    }
    return {
      outcome: normalized.outcome,
      sdkKeyPatch: { ...baseKeyPatch, ...(normalized.sdkKeyPatch ?? {}) },
    };
  } catch (err) {
     
    console.warn('[rheo] RevenueCat paywall failed:', err);
    return {
      outcome: 'failed',
      sdkKeyPatch: { ...baseKeyPatch, onb_rc_last_event: 'failed' },
    };
  }
};
