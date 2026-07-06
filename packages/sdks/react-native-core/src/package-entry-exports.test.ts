import { describe, expect, it, vi } from 'vitest';

vi.mock('./ui', () => ({
  LayerRenderer: () => null,
  Flow: () => null,
}));

import { carouselSnapDurationMs } from '@getrheo/flow-runtime';

import { LayerRenderer, Flow, RheoProvider, buildBrandingFontLoadMap, generateEventId } from './index';

describe('@getrheo/react-native-core public entry', () => {
  it('exports core symbols', () => {
    expect(RheoProvider).toBeDefined();
    expect(typeof buildBrandingFontLoadMap).toBe('function');
    expect(typeof generateEventId).toBe('function');
    expect(typeof Flow).toBe('function');
    expect(typeof LayerRenderer).toBe('function');
  });

  // IMP-515 — carousel snap duration re-exported from @getrheo/flow-runtime for RN consumers.
  it('imports carouselSnapDurationMs from @getrheo/flow-runtime', () => {
    expect(typeof carouselSnapDurationMs).toBe('function');
    expect(carouselSnapDurationMs({ distance: 120, snapInterval: 120 })).toBe(280);
  });
});
