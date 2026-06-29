import type { RheoConfig } from '@getrheo/react-native-bare';

export const EXAMPLE_CONFIG_STORAGE_KEY = 'rheo.exampleConfig.v1';

export const DEFAULT_API_URL = 'http://localhost:4000';

export type SavedConfig = {
  publishableKey: string;
  channelId: string;
  apiBaseUrl: string;
  userId: string;
  hideFlowNavigationBar?: boolean;
};

export const defaultSavedConfig = (): SavedConfig => ({
  publishableKey: '',
  channelId: '',
  apiBaseUrl: DEFAULT_API_URL,
  userId: 'example-user',
  hideFlowNavigationBar: false,
});

export const normalizeSavedConfig = (parsed: Partial<SavedConfig>): SavedConfig => ({
  ...defaultSavedConfig(),
  ...parsed,
  apiBaseUrl: parsed.apiBaseUrl || DEFAULT_API_URL,
  userId: parsed.userId || 'example-user',
  hideFlowNavigationBar: parsed.hideFlowNavigationBar ?? false,
});

export const canStartExampleConfig = (config: SavedConfig): boolean =>
  config.publishableKey.trim().length > 0 &&
  config.channelId.trim().length > 0 &&
  config.apiBaseUrl.trim().length > 0;

export const buildExampleRheoConfig = (config: SavedConfig): RheoConfig => ({
  publishableKey: config.publishableKey.trim(),
  apiBaseUrl: config.apiBaseUrl.trim() || DEFAULT_API_URL,
  userId: config.userId.trim() || 'example-user',
  locale: 'en',
});
