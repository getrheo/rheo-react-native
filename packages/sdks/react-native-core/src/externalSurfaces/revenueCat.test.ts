import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSdkLogLevel } from '../logging/sdkLogger';
import {
  __setRevenueCatModuleForTests,
  __setRevenueCatPurchasesModuleForTests,
  extractRevenueCatPurchaseCommerce,
  normalizeRcPaywallResult,
  presentRevenueCatPaywall,
} from './revenueCat';

describe('normalizeRcPaywallResult', () => {
  it('maps PURCHASED to purchase_completed', () => {
    expect(normalizeRcPaywallResult('PURCHASED').outcome).toBe('purchase_completed');
  });

  it('maps RESTORED to restore_completed', () => {
    expect(normalizeRcPaywallResult('RESTORED').outcome).toBe('restore_completed');
  });

  it('maps CANCELLED to purchase_cancelled', () => {
    expect(normalizeRcPaywallResult('CANCELLED').outcome).toBe('purchase_cancelled');
  });

  it('maps NOT_PRESENTED to dismissed', () => {
    expect(normalizeRcPaywallResult('NOT_PRESENTED').outcome).toBe('dismissed');
  });

  it('maps ERROR and unknown values to failed', () => {
    expect(normalizeRcPaywallResult('ERROR').outcome).toBe('failed');
    expect(normalizeRcPaywallResult('something-weird').outcome).toBe('failed');
    expect(normalizeRcPaywallResult(undefined).outcome).toBe('failed');
  });

  it('always emits onb_rc_last_event in the sdk key patch', () => {
    expect(normalizeRcPaywallResult('PURCHASED').sdkKeyPatch?.onb_rc_last_event).toBe(
      'purchase_completed',
    );
    expect(normalizeRcPaywallResult('CANCELLED').sdkKeyPatch?.onb_rc_last_event).toBe(
      'purchase_cancelled',
    );
  });
});

describe('presentRevenueCatPaywall', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
    registerSdkLogLevel('silent');
  });

  it('falls back to `failed` when react-native-purchases-ui is not installed', async () => {
    registerSdkLogLevel('warn');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    restore = __setRevenueCatModuleForTests(null);
    const result = await presentRevenueCatPaywall({
      provider: 'revenuecat',
      offeringId: 'default',
    });
    expect(result.outcome).toBe('failed');
    expect(result.sdkKeyPatch?.onb_rc_last_event).toBe('failed');
    expect(result.sdkKeyPatch?.onb_rc_last_offering_id).toBe('default');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('calls presentPaywall by default and normalizes PURCHASED', async () => {
    const presentPaywall = vi.fn().mockResolvedValue('PURCHASED');
    restore = __setRevenueCatModuleForTests({ presentPaywall });
    const result = await presentRevenueCatPaywall({
      provider: 'revenuecat',
      offeringId: 'pro_offering',
    });
    expect(presentPaywall).toHaveBeenCalledWith({ offering: { identifier: 'pro_offering' } });
    expect(result.outcome).toBe('purchase_completed');
    expect(result.sdkKeyPatch?.onb_rc_last_offering_id).toBe('pro_offering');
  });

  it('uses presentPaywallIfNeeded when configured', async () => {
    const presentPaywallIfNeeded = vi.fn().mockResolvedValue('CANCELLED');
    restore = __setRevenueCatModuleForTests({ presentPaywallIfNeeded });
    const result = await presentRevenueCatPaywall({
      provider: 'revenuecat',
      offeringId: 'pro_offering',
      presentation: 'paywall_if_needed',
    });
    expect(presentPaywallIfNeeded).toHaveBeenCalled();
    expect(result.outcome).toBe('purchase_cancelled');
  });

  it('returns `failed` when the module throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    restore = __setRevenueCatModuleForTests({
      presentPaywall: () => Promise.reject(new Error('boom')),
    });
    const result = await presentRevenueCatPaywall({ provider: 'revenuecat' });
    expect(result.outcome).toBe('failed');
    warn.mockRestore();
  });
});

describe('extractRevenueCatPurchaseCommerce', () => {
  let restorePurchases: (() => void) | null = null;
  afterEach(() => {
    restorePurchases?.();
    restorePurchases = null;
    registerSdkLogLevel('silent');
  });

  it('returns undefined when react-native-purchases is not installed', async () => {
    restorePurchases = __setRevenueCatPurchasesModuleForTests(null);
    const commerce = await extractRevenueCatPurchaseCommerce({
      provider: 'revenuecat',
      offeringId: 'default',
    });
    expect(commerce).toBeUndefined();
  });

  it('reads product_id, price, currency, and period_type from the matching offering package', async () => {
    restorePurchases = __setRevenueCatPurchasesModuleForTests({
      getCustomerInfo: () =>
        Promise.resolve({
          entitlements: {
            active: {
              pro: {
                productIdentifier: 'pro_annual',
                periodType: 'NORMAL',
                latestPurchaseDateMillis: 1_700_000_000_000,
              },
            },
          },
          activeSubscriptions: ['pro_annual'],
        }),
      getOfferings: () =>
        Promise.resolve({
          current: null,
          all: {
            default: {
              identifier: 'default',
              availablePackages: [
                {
                  identifier: '$rc_annual',
                  storeProduct: {
                    identifier: 'pro_annual',
                    price: 49.99,
                    currencyCode: 'usd',
                  },
                },
              ],
            },
          },
        }),
    });
    const commerce = await extractRevenueCatPurchaseCommerce({
      provider: 'revenuecat',
      offeringId: 'default',
    });
    expect(commerce).toEqual({
      product_id: 'pro_annual',
      offering_id: 'default',
      package_id: '$rc_annual',
      price: 49.99,
      currency: 'USD',
      period_type: 'normal',
    });
  });

  it('emits product_id only when price metadata is unavailable', async () => {
    restorePurchases = __setRevenueCatPurchasesModuleForTests({
      getCustomerInfo: () =>
        Promise.resolve({
          activeSubscriptions: ['lifetime'],
        }),
      getOfferings: () =>
        Promise.resolve({
          current: null,
          all: {},
        }),
    });
    const commerce = await extractRevenueCatPurchaseCommerce({
      provider: 'revenuecat',
      offeringId: 'default',
    });
    expect(commerce).toMatchObject({ product_id: 'lifetime', offering_id: 'default' });
    expect(commerce?.price).toBeUndefined();
    expect(commerce?.currency).toBeUndefined();
  });

  it('falls back gracefully when getCustomerInfo throws', async () => {
    registerSdkLogLevel('warn');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    restorePurchases = __setRevenueCatPurchasesModuleForTests({
      getCustomerInfo: () => Promise.reject(new Error('rc down')),
    });
    const commerce = await extractRevenueCatPurchaseCommerce({
      provider: 'revenuecat',
      offeringId: 'default',
    });
    expect(commerce).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
