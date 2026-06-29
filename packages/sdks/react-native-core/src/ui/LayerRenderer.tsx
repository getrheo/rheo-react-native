import { Branding } from '@getrheo/contracts/branding';
import type {ReactNode} from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type {ViewStyle} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScreenInputDraftProvider,
} from '@getrheo/flow-ui-state/draft';
import {
  ScreenCheckboxAckProvider,
} from '@getrheo/flow-ui-state';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  findInputLayer,
  resolveCommonStyleAtWidth,
  resolveScreenContainerStyleAtWidth,
} from '@getrheo/flow-runtime';
import { resolveEffectiveScreenShellPadding } from '@getrheo/flow-runtime/responsive/screenShellInsets';

import type { ButtonAction, FlowManifest, Layer, Screen } from '@getrheo/contracts';
import type {StepResponse, InterpolationContext} from '@getrheo/flow-runtime';
import { layerRestingMotionEntries } from '@getrheo/flow-runtime';
import {
  flowChildLayoutViewStyle,
  screenContainerChromeInsets,
  wrapperLayoutViewStyle,
} from './styles';
import { LayerMotionShell, MotionProvider } from './motion';
import { MediaPlaybackProvider } from './mediaPlayback';
import { BackButtonView, ButtonView } from './layers/actionLayers';
import { CarouselView } from './layers/carouselLayers';
import { MultipleChoiceView, SingleChoiceView } from './layers/choiceLayers';
import { CounterView, LoaderView, ProgressView } from './layers/feedbackLayers';
import { ChromeView, type Ctx } from './LayerRendererShared';
import { HyperlinkView, StackView, TextView } from './layers/layoutLayers';
import { IconView, ImageView, LottieLayerView, VideoLayerView } from './layers/mediaLayers';
import { CheckboxView, ScaleInputView, TextInputView } from './layers/inputLayers';
import { EmailPasswordAuthView, OAuthLoginView } from './layers/authLayers';
import { ScreenShellBackdrop } from './screenBackground';

export type LayerRendererProps = {
  manifest: FlowManifest;
  screen: Screen;
  locale?: string;
  /** When false, taps and inputs are no-ops (used by previews). */
  interactive?: boolean;
  onRespond?: (r: StepResponse) => void;
  onAction?: (
    a: ButtonAction,
    meta?: import('../useFlow/nativeButtonActionMeta.js').NativeButtonActionMeta,
  ) => void;
  mediaMap?: Record<string, string>;
  theme?: 'light' | 'dark';
  interpolationContext?: InterpolationContext;
  /**
   * After the system successfully opens a hyperlink URL (React Native `Linking.openURL`).
   * Hosts use this to emit analytics (`external_link_opened`).
   */
  onHyperlinkOpened?: (meta: { layerId: string; href: string }) => void;
  /** App branding for `$brandGradient:` backgrounds when manifest references presets. */
  branding?: Branding;
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const renderLayerInner = (layer: Layer, ctx: Ctx): ReactNode => {
  // Only stacks consume `isRegionRoot`. Strip it before recursing into
  // any non-stack so it never leaks into nested layers (mirrors DOM).
  if (layer.kind !== 'stack' && ctx.isRegionRoot) {
    ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };
  }
  switch (layer.kind) {
    case 'stack':
      return <StackView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'text':
      return <TextView layer={layer} ctx={ctx} />;
    case 'hyperlink':
      return <HyperlinkView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'image':
      return <ImageView layer={layer} ctx={ctx} />;
    case 'lottie':
      return <LottieLayerView layer={layer} ctx={ctx} />;
    case 'video':
      return <VideoLayerView layer={layer} ctx={ctx} />;
    case 'icon':
      return <IconView layer={layer} ctx={ctx} />;
    case 'button':
      return <ButtonView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'back_button':
      return <BackButtonView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'progress':
      return <ProgressView layer={layer} ctx={ctx} />;
    case 'loader':
      return <LoaderView layer={layer} ctx={ctx} />;
    case 'counter':
      return <CounterView layer={layer} ctx={ctx} />;
    case 'checkbox':
      return <CheckboxView layer={layer} ctx={ctx} />;
    case 'single_choice':
      return <SingleChoiceView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'multiple_choice':
      return <MultipleChoiceView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'text_input':
      return <TextInputView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'scale_input':
      return <ScaleInputView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'oauth_provider':
      return <View />;
    case 'oauth_login':
      return <OAuthLoginView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'email_password_field':
    case 'email_password_submit':
      return null;
    case 'email_password_auth':
      return <EmailPasswordAuthView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
    case 'carousel':
      return <CarouselView layer={layer} ctx={ctx} renderLayer={renderLayer} />;
  }
};

/** Wrap every layer so clips/resting motion keyed by `layer.id` apply (not only region roots). */
const renderLayer = (layer: Layer, ctx: Ctx): ReactNode => {
  const viewportW = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolved =
    'style' in layer
      ? resolveCommonStyleAtWidth(
          layer.style,
          'styleBreakpoints' in layer ? layer.styleBreakpoints : undefined,
          viewportW,
        )
      : undefined;
  const heightFill = resolved?.height === 'fill' || resolved?.height === 'full';
  return (
    <LayerMotionShell
      layerId={layer.id}
      restingMotionEntries={layerRestingMotionEntries(layer)}
      heightFill={heightFill}
      layoutStyle={{
        ...wrapperLayoutViewStyle(resolved),
        ...flowChildLayoutViewStyle(resolved, ctx.parentStackDirection, ctx.parentStackAlign),
      }}
    >
      {renderLayerInner(layer, ctx)}
    </LayerMotionShell>
  );
};

// ---------------------------------------------------------------------------
// Public renderer
// ---------------------------------------------------------------------------

export const LayerRenderer = ({
  manifest,
  screen,
  locale = 'en',
  interactive = true,
  onRespond,
  onAction,
  mediaMap,
  theme = 'dark',
  interpolationContext,
  onHyperlinkOpened,
  branding,
}: LayerRendererProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const ctx: Ctx = {
    manifest,
    screen,
    locale,
    interactive,
    mediaMap,
    onRespond,
    onAction,
    onHyperlinkOpened,
    theme,
    interpolationContext,
    previewWidthPx: windowWidth,
    branding,
  };
  // Inputs lookup is only used to keep the screen-input draft in lockstep
  // with the rendered screen — useFlow already drives draft resets via
  // ScreenInputDraftProvider's `screen` prop key.
  void findInputLayer;
  const containerColor = theme === 'dark' ? '#0a0a0a' : '#ffffff';
  const viewportW = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedScreenChrome = resolveScreenContainerStyleAtWidth(
    screen.containerStyle,
    screen.containerStyleBreakpoints,
    viewportW,
  );
  const shellFill = resolvedScreenChrome?.backgroundFill;
  const shellUsesMediaBackdrop =
    shellFill?.kind === 'image' || shellFill?.kind === 'video';
  const effectiveShellPadding = resolveEffectiveScreenShellPadding({
    manual: resolvedScreenChrome?.padding,
    insetSafeArea: resolvedScreenChrome?.insetSafeArea,
    safeAreaInsets: {
      t: safeAreaInsets.top,
      r: 0,
      b: safeAreaInsets.bottom,
      l: 0,
    },
  });
  const shellInsetStyle = screenContainerChromeInsets(
    effectiveShellPadding,
    resolvedScreenChrome?.margin,
  );
  const hasHorizontalMargin =
    (resolvedScreenChrome?.margin?.l ?? 0) > 0 ||
    (resolvedScreenChrome?.margin?.r ?? 0) > 0;
  const shellStyle: ViewStyle = {
    flex: 1,
    ...(hasHorizontalMargin ? { alignSelf: 'stretch' } : { width: '100%' }),
    ...shellInsetStyle,
    ...(shellFill
      ? { position: 'relative', backgroundColor: 'transparent', overflow: 'hidden' }
      : { backgroundColor: containerColor }),
  };
  const shellForegroundStyle: ViewStyle = {
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'column',
    position: 'relative',
    zIndex: 1,
    elevation: 1,
  };

  const regions = (
    <>
        {screen.regions.header && (
          <View style={{ flexShrink: 0 }}>
            {renderLayer(screen.regions.header, {
              ...ctx,
              isRegionRoot: true,
              regionKind: 'header',
            })}
          </View>
        )}
        <View style={{ flex: 1, minHeight: 0 }}>
          <ScrollView
            style={{
              flex: 1,
              ...(shellUsesMediaBackdrop ? { backgroundColor: 'transparent' } : {}),
            }}
            contentContainerStyle={{ flexGrow: 1, minHeight: '100%' }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <View style={{ flex: 1, width: '100%', minHeight: '100%' }}>
              {renderLayer(screen.regions.body, {
                ...ctx,
                isRegionRoot: true,
                regionKind: 'body',
              })}
            </View>
          </ScrollView>
        </View>
        {screen.regions.footer && (
          <View style={{ flexShrink: 0 }}>
            {renderLayer(screen.regions.footer, {
              ...ctx,
              isRegionRoot: true,
              regionKind: 'footer',
            })}
          </View>
        )}
    </>
  );

  return (
    <ScreenCheckboxAckProvider screen={screen}>
      <ScreenInputDraftProvider screen={screen}>
        <MotionProvider screen={screen}>
        <MediaPlaybackProvider>
        <ChromeView style={shellStyle} linearGradient={null}>
          {shellFill ? (
            <View
              style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
              pointerEvents="none"
              collapsable={false}
            >
              <ScreenShellBackdrop screen={screen} ctx={ctx} />
            </View>
          ) : null}
          <View style={shellForegroundStyle} pointerEvents="box-none">
            {regions}
          </View>
        </ChromeView>
        </MediaPlaybackProvider>
        </MotionProvider>
      </ScreenInputDraftProvider>
    </ScreenCheckboxAckProvider>
  );
};
