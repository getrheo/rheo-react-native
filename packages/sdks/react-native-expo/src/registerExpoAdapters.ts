import {
  registerAppReviewAdapter,
  registerFontAdapter,
  registerPushTokenAdapter,
  registerVideoAdapter,
} from '@getrheo/react-native-core/platform';
import { expoAppReviewAdapter } from './adapters/expoAppReview.js';
import { expoFontAdapter } from './adapters/expoFont.js';
import { expoPushTokenAdapter } from './adapters/expoPushToken.js';
import { ExpoScreenShellVideoBackdrop, ExpoVideoLayerView } from './adapters/expoVideo.js';

registerAppReviewAdapter(expoAppReviewAdapter);
registerFontAdapter(expoFontAdapter);
registerPushTokenAdapter(expoPushTokenAdapter);
registerVideoAdapter({
  VideoLayerView: ExpoVideoLayerView,
  ScreenShellVideoBackdrop: ExpoScreenShellVideoBackdrop,
});
