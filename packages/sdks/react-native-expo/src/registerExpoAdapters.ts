import { registerAppReviewAdapter, registerFontAdapter, registerVideoAdapter } from '@getrheo/react-native-core/platform';
import { expoAppReviewAdapter } from './adapters/expoAppReview.js';
import { expoFontAdapter } from './adapters/expoFont.js';
import { ExpoScreenShellVideoBackdrop, ExpoVideoLayerView } from './adapters/expoVideo.js';

registerAppReviewAdapter(expoAppReviewAdapter);
registerFontAdapter(expoFontAdapter);
registerVideoAdapter({
  VideoLayerView: ExpoVideoLayerView,
  ScreenShellVideoBackdrop: ExpoScreenShellVideoBackdrop,
});
