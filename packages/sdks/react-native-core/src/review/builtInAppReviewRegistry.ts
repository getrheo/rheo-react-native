/** Delay after `requestReview()` when the prompt may have been shown (iOS has no dismiss callback). */
export const APP_REVIEW_POST_PROMPT_DELAY_MS = 1500;

export type AppReviewRequestResult = { shown: false } | { shown: true };

import { getAppReviewAdapter } from '../platform/appReviewAdapter.js';

/**
 * Invokes the flavor-registered in-app review adapter (Expo StoreReview or bare in-app-review).
 */
export const runBuiltInAppReviewIfAvailable = async (
  sessionPlatform: string,
): Promise<AppReviewRequestResult> => {
  if (sessionPlatform === 'web') {
    return { shown: false };
  }
  return getAppReviewAdapter().requestReview(sessionPlatform);
};
