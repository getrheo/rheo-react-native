import { describe, expect, it } from 'vitest';
import { SdkCodeResolveResponseSchema } from '@getrheo/contracts/sdkChannel';
import {
  clearCodeResolveCacheForTests,
  exposureKey,
  withCodeGet,
} from './resolve/resolveChannel.js';

describe('useChannel code body', () => {
  it('get returns fallback on a missing key or a different type, and keeps false and null', () => {
    clearCodeResolveCacheForTests();
    const channel = withCodeGet(
      SdkCodeResolveResponseSchema.parse({
        kind: 'code',
        channelId: 'ch_code',
        environment: 'test',
        assignmentVersion: 4,
        experiment: {
          id: '11111111-1111-4111-8111-111111111111',
          variantKey: 'treatment',
          variantId: '33333333-3333-4333-8333-333333333333',
        },
        variantKey: 'treatment',
        parameters: { enabled: false, title: 'Hi', empty: null },
      }),
    );
    expect(channel.get('enabled', true)).toBe(false);
    expect(channel.get('empty', null)).toBeNull();
    expect(channel.get('missing', 'fallback')).toBe('fallback');
    expect(channel.get('title', 1)).toBe(1);
    expect(
      exposureKey('user', channel.experiment!.id, channel.experiment!.variantId, 4),
    ).toBe(
      exposureKey('user', channel.experiment!.id, channel.experiment!.variantId, 4),
    );
    expect(
      exposureKey('user', channel.experiment!.id, channel.experiment!.variantId, 5),
    ).not.toBe(
      exposureKey('user', channel.experiment!.id, channel.experiment!.variantId, 4),
    );
  });
});