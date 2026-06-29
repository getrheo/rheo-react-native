import * as StoreReview from 'expo-store-review';
import type { AppReviewAdapter } from '@getrheo/react-native-core/platform';
import type { AppReviewRequestResult } from '@getrheo/react-native-core';

const APP_REVIEW_POST_PROMPT_DELAY_MS = 1500;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const expoAppReviewAdapter: AppReviewAdapter = {
  requestReview: async (sessionPlatform: string): Promise<AppReviewRequestResult> => {
    if (sessionPlatform === 'web') {
      return { shown: false };
    }

    let canShow: boolean;
    try {
      canShow = await StoreReview.hasAction();
    } catch {
      return { shown: false };
    }

    if (!canShow) {
      return { shown: false };
    }

    try {
      await StoreReview.requestReview();
      await delay(APP_REVIEW_POST_PROMPT_DELAY_MS);
      return { shown: true };
    } catch {
      return { shown: false };
    }
  },
};
