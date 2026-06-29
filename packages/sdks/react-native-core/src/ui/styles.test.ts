import { describe, expect, it } from 'vitest';
import { textLayerStyle } from './styles';

describe('textLayerStyle', () => {
  it('uses DEFAULT_THEMED_FOREGROUND when inheritDocumentForeground and color omitted', () => {
    expect(
      textLayerStyle({ fontSize: 20 }, undefined, 'dark', { inheritDocumentForeground: true }).color,
    ).toBe('#ffffff');
    expect(
      textLayerStyle({ fontSize: 20 }, undefined, 'light', { inheritDocumentForeground: true }).color,
    ).toBe('#000000');
  });

  it('leaves color undefined for button-merge path when color omitted', () => {
    expect(textLayerStyle({ fontSize: 13 }, undefined, 'dark').color).toBeUndefined();
  });

  it('still respects explicit hex colors with inherit flag', () => {
    expect(
      textLayerStyle({ color: '#ef4444' }, undefined, 'dark', { inheritDocumentForeground: true }).color,
    ).toBe('#ef4444');
  });
});
