import { describe, expect, it } from 'vitest';
import { normalizeAppsFlyerConversionPayload } from './providers/appsflyer';

describe('normalizeAppsFlyerConversionPayload', () => {
  it('maps wrapped conversion payloads to universal snapshot shape', () => {
    const snap = normalizeAppsFlyerConversionPayload({
      data: {
        af_status: 'Non-organic',
        media_source: 'facebook',
        campaign: 'c1',
        af_sub1: 'alice',
        deep_link_value: 'promo_x',
      },
    });
    expect(snap.providerId).toBe('appsflyer');
    expect(snap.attribution.isOrganic).toBe(false);
    expect(snap.acquisition.source).toBe('facebook');
    expect(snap.acquisition.campaign).toBe('c1');
    expect(snap.link.entry).toBe('promo_x');
    expect(snap.link.params?.sub_1).toBe('alice');
  });
});
