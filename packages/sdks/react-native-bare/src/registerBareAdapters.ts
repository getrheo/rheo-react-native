import { registerAppReviewAdapter, registerVideoAdapter } from '@getrheo/react-native-core/platform';
import { bareAppReviewAdapter } from './adapters/bareAppReview.js';
import { BareScreenShellVideoBackdrop, BareVideoLayerView } from './adapters/bareVideo.js';

registerAppReviewAdapter(bareAppReviewAdapter);
registerVideoAdapter({
  VideoLayerView: BareVideoLayerView,
  ScreenShellVideoBackdrop: BareScreenShellVideoBackdrop,
});
