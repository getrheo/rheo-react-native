import { describe, expect, it, vi } from 'vitest';

vi.mock('./ui', () => ({
  LayerRenderer: () => null,
  Flow: () => null,
}));

import { LayerRenderer, Flow, RheoProvider, buildBrandingFontLoadMap, generateEventId } from './index';

describe('@getrheo/react-native-core public entry', () => {
  it('exports core symbols', () => {
    expect(RheoProvider).toBeDefined();
    expect(typeof buildBrandingFontLoadMap).toBe('function');
    expect(typeof generateEventId).toBe('function');
    expect(typeof Flow).toBe('function');
    expect(typeof LayerRenderer).toBe('function');
  });
});
