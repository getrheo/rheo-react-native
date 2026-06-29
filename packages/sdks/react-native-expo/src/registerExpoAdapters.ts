import { registerAppReviewAdapter, registerVideoAdapter } from '@getrheo/react-native-core/platform';
import { expoAppReviewAdapter } from './adapters/expoAppReview.js';
import { ExpoScreenShellVideoBackdrop, ExpoVideoLayerView } from './adapters/expoVideo.js';

registerAppReviewAdapter(expoAppReviewAdapter);
registerVideoAdapter({
  VideoLayerView: ExpoVideoLayerView,
  ScreenShellVideoBackdrop: ExpoScreenShellVideoBackdrop,
});
