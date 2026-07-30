import { registerAppReviewAdapter, registerFontAdapter, registerVideoAdapter } from '@getrheo/react-native-core/platform';
import { bareAppReviewAdapter } from './adapters/bareAppReview.js';
import { bareFontAdapter } from './adapters/bareFont.js';
import { BareScreenShellVideoBackdrop, BareVideoLayerView } from './adapters/bareVideo.js';

registerAppReviewAdapter(bareAppReviewAdapter);
registerFontAdapter(bareFontAdapter);
registerVideoAdapter({
  VideoLayerView: BareVideoLayerView,
  ScreenShellVideoBackdrop: BareScreenShellVideoBackdrop,
});
