import type { RheoConfig } from '@getrheo/react-native-expo';

export const EXAMPLE_CONFIG_STORAGE_KEY = 'rheo.exampleConfig.v1';

export type SavedConfig = {
  publishableKey: string;
  channelId: string;
  apiBaseUrl: string;
  userId: string;
  /** When true, `<Flow fallback={…} />` shows hardcoded offline UI on resolve failure. */
  useResolveFallback?: boolean;
  /** When true, hide the Expo Router stack header on the onboarding route. */
  hideFlowNavigationBar?: boolean;
};

export const canStartExampleConfig = (config: SavedConfig): boolean =>
  config.publishableKey.trim().length > 0 &&
  config.channelId.trim().length > 0 &&
  config.apiBaseUrl.trim().length > 0;

/** Rheo config for the example app — must stay aligned with the onboarding route. */
export const buildExampleRheoConfig = (config: SavedConfig): RheoConfig => ({
  publishableKey: config.publishableKey.trim(),
  apiBaseUrl: config.apiBaseUrl.trim(),
  userId: config.userId.trim() || 'example-user',
  appVersion: '0.1.0',
  sessionId: `sess_${Date.now()}`,
  locale: 'en',
});
