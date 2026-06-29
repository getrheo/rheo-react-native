import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setAppReviewAdapterForTests,
} from '../platform/appReviewAdapter.js';
import { runBuiltInAppReviewIfAvailable } from './builtInAppReviewRegistry.js';

describe('runBuiltInAppReviewIfAvailable', () => {
  beforeEach(() => {
    __setAppReviewAdapterForTests({
      requestReview: vi.fn(async (platform: string) =>
        platform === 'web' ? { shown: false } : { shown: true },
      ),
    });
  });

  afterEach(() => {
    __setAppReviewAdapterForTests(null);
    vi.clearAllMocks();
  });

  it('returns not shown on web', async () => {
    await expect(runBuiltInAppReviewIfAvailable('web')).resolves.toEqual({ shown: false });
  });

  it('delegates to the registered adapter on native', async () => {
    await expect(runBuiltInAppReviewIfAvailable('ios')).resolves.toEqual({ shown: true });
  });
});
