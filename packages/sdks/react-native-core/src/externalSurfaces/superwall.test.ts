import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSdkLogLevel } from '../logging/sdkLogger';
import {
  __setSuperwallModuleForTests,
  normalizeSuperwallResult,
  presentSuperwallPaywall,
} from './superwall';

describe('normalizeSuperwallResult', () => {
  it('maps purchased dismiss to purchase_completed', () => {
    const result = normalizeSuperwallResult({
      kind: 'dismiss',
      dismiss: { type: 'purchased', productId: 'pro_annual' },
    });
    expect(result.outcome).toBe('purchase_completed');
    expect(result.commerce?.product_id).toBe('pro_annual');
    expect(result.sdkKeyPatch?.onb_sw_last_event).toBe('purchase_completed');
    expect(result.sdkKeyPatch?.onb_sw_last_product_id).toBe('pro_annual');
  });

  it('maps restored dismiss to restore_completed', () => {
    expect(
      normalizeSuperwallResult({ kind: 'dismiss', dismiss: { type: 'restored' } }).outcome,
    ).toBe('restore_completed');
  });

  it('maps declined dismiss to purchase_cancelled', () => {
    expect(
      normalizeSuperwallResult({ kind: 'dismiss', dismiss: { type: 'declined' } }).outcome,
    ).toBe('purchase_cancelled');
  });

  it('maps skip and feature to dismissed', () => {
    expect(normalizeSuperwallResult({ kind: 'skip' }).outcome).toBe('dismissed');
    expect(normalizeSuperwallResult({ kind: 'feature' }).outcome).toBe('dismissed');
  });

  it('maps error to failed', () => {
    expect(normalizeSuperwallResult({ kind: 'error' }).outcome).toBe('failed');
  });
});

describe('presentSuperwallPaywall', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
    registerSdkLogLevel('silent');
  });

  it('falls back to failed when Superwall is not installed', async () => {
    registerSdkLogLevel('warn');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    restore = __setSuperwallModuleForTests(null);
    const result = await presentSuperwallPaywall({
      provider: 'superwall',
      placementId: 'campaign_trigger',
    });
    expect(result.outcome).toBe('failed');
    expect(result.sdkKeyPatch?.onb_sw_last_event).toBe('failed');
    expect(result.sdkKeyPatch?.onb_sw_last_placement_id).toBe('campaign_trigger');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('fails when placementId is missing', async () => {
    restore = __setSuperwallModuleForTests({
      Superwall: {
        shared: {
          register: vi.fn(),
        },
      },
    });
    const result = await presentSuperwallPaywall({ provider: 'superwall' });
    expect(result.outcome).toBe('failed');
  });

  it('registers a placement and normalizes purchased dismiss', async () => {
    const register = vi.fn(
      async (args: {
        placement: string;
        handler?: {
          onDismiss?: (info: unknown, result: { type: string; productId: string }) => void;
        };
      }) => {
        args.handler?.onDismiss?.({}, { type: 'purchased', productId: 'pro_monthly' });
      },
    );
    restore = __setSuperwallModuleForTests({
      Superwall: { shared: { register } },
    });
    const result = await presentSuperwallPaywall({
      provider: 'superwall',
      placementId: 'campaign_trigger',
    });
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ placement: 'campaign_trigger' }),
    );
    expect(result.outcome).toBe('purchase_completed');
    expect(result.commerce?.product_id).toBe('pro_monthly');
    expect(result.sdkKeyPatch?.onb_sw_last_placement_id).toBe('campaign_trigger');
  });

  it('returns failed when register throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    restore = __setSuperwallModuleForTests({
      Superwall: {
        shared: {
          register: () => Promise.reject(new Error('boom')),
        },
      },
    });
    const result = await presentSuperwallPaywall({
      provider: 'superwall',
      placementId: 'campaign_trigger',
    });
    expect(result.outcome).toBe('failed');
    warn.mockRestore();
  });
});
