import type { AppReviewRequestResult } from '../review/builtInAppReviewRegistry.js';

export type AppReviewAdapter = {
  requestReview: (sessionPlatform: string) => Promise<AppReviewRequestResult>;
};

let adapter: AppReviewAdapter | null = null;

export const registerAppReviewAdapter = (next: AppReviewAdapter): void => {
  adapter = next;
};

export const getAppReviewAdapter = (): AppReviewAdapter => {
  if (!adapter) {
    throw new Error(
      'Rheo native adapters are not registered. Import from @getrheo/react-native-expo or @getrheo/react-native-bare (not @getrheo/react-native-core).',
    );
  }
  return adapter;
};

/** Vitest and internal tests may inject an adapter without a flavor package. */
export const __resetAppReviewAdapterForTests = (): void => {
  adapter = null;
};

export const __setAppReviewAdapterForTests = (next: AppReviewAdapter | null): void => {
  adapter = next;
};
