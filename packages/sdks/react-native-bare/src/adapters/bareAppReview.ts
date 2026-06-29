import InAppReview from 'react-native-in-app-review';
import type { AppReviewAdapter } from '@getrheo/react-native-core/platform';
import type { AppReviewRequestResult } from '@getrheo/react-native-core';

const APP_REVIEW_POST_PROMPT_DELAY_MS = 1500;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const bareAppReviewAdapter: AppReviewAdapter = {
  requestReview: async (sessionPlatform: string): Promise<AppReviewRequestResult> => {
    if (sessionPlatform === 'web') {
      return { shown: false };
    }

    if (!InAppReview.isAvailable()) {
      return { shown: false };
    }

    try {
      const shown = await InAppReview.RequestInAppReview();
      if (!shown) {
        return { shown: false };
      }
      await delay(APP_REVIEW_POST_PROMPT_DELAY_MS);
      return { shown: true };
    } catch {
      return { shown: false };
    }
  },
};
