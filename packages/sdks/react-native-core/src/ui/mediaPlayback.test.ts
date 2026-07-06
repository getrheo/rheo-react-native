import { describe, expect, it } from 'vitest';
import { mediaAutoPlayOnMount } from './mediaPlayback';

describe('mediaAutoPlayOnMount', () => {
  it('defaults autoPlay to on when omitted', () => {
    expect(mediaAutoPlayOnMount({})).toBe(true);
    expect(mediaAutoPlayOnMount({ autoPlay: true })).toBe(true);
    expect(mediaAutoPlayOnMount({ autoPlay: false })).toBe(false);
  });
});
