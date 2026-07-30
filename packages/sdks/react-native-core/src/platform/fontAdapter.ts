import type { Branding } from '@getrheo/contracts/branding';
import { buildBrandingFontLoadMap } from '@getrheo/renderer-core';
import { getSdkLogger } from '../logging/sdkLogger.js';

export type FontAdapter = {
  /** Register remote/local font files keyed by native family name (`RheoFont__{styleId}`). */
  loadFonts: (fonts: Record<string, string>) => Promise<void>;
};

let adapter: FontAdapter | null = null;
const loadedKeys = new Set<string>();

export const registerFontAdapter = (next: FontAdapter): void => {
  adapter = next;
};

export const getFontAdapter = (): FontAdapter | null => adapter;

/** Vitest and internal tests may inject an adapter without a flavor package. */
export const __resetFontAdapterForTests = (): void => {
  adapter = null;
  loadedKeys.clear();
};

export const __setFontAdapterForTests = (next: FontAdapter | null): void => {
  adapter = next;
  loadedKeys.clear();
};

/**
 * Download/register branding fonts via the flavor font adapter.
 * Best-effort: failures are logged and do not block flow render (system fallback).
 */
export const loadBrandingFonts = async (
  branding: Branding | null | undefined,
  mediaMap?: Record<string, string> | null,
): Promise<void> => {
  const fonts = buildBrandingFontLoadMap(branding, mediaMap);
  const entries = Object.entries(fonts);
  if (entries.length === 0) return;

  const pending: Record<string, string> = {};
  for (const [name, url] of entries) {
    const key = `${name}\0${url}`;
    if (loadedKeys.has(key)) continue;
    pending[name] = url;
  }
  if (Object.keys(pending).length === 0) return;

  const fontAdapter = adapter;
  if (!fontAdapter) {
    getSdkLogger().debug(
      '[rheo] Branding fonts present but no font adapter is registered; text will use the system font.',
    );
    return;
  }

  try {
    await fontAdapter.loadFonts(pending);
    for (const [name, url] of Object.entries(pending)) {
      loadedKeys.add(`${name}\0${url}`);
    }
  } catch (err) {
    getSdkLogger().warn('[rheo] Failed to load branding fonts:', err);
  }
};
