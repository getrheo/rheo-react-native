import { __setAppReviewAdapterForTests, __setVideoAdapterForTests } from './src/platform/index.js';

__setAppReviewAdapterForTests({
  requestReview: async () => ({ shown: false }),
});

__setVideoAdapterForTests({
  VideoLayerView: () => null,
  ScreenShellVideoBackdrop: () => null,
});
