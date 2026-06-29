import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Image,
  Text,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { getVideoAdapter } from '../../platform/videoAdapter.js';
import type { VideoLayerViewProps } from '../../platform/videoAdapter.js';
import LottieView from 'lottie-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SvgUri } from 'react-native-svg';
import { isSvgMediaUrl } from '@getrheo/contracts/imageContentType';
import type { IconLayer, ImageLayer, LottieLayer, VideoLayer } from '@getrheo/contracts';
import { DEFAULT_THEMED_FOREGROUND } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  resolveIconStyleAtWidth,
  resolveImageStyleAtWidth,
  resolveThemedColor,
} from '@getrheo/flow-runtime';
import { ChromeView, type Ctx } from '../LayerRendererShared';
import {
  mediaAutoPlayOnMount,
  useMediaPlayback,
  useMediaPlaySignal,
} from '../mediaPlayback';
import {
  commonViewStylePair,
  layoutHeightFor,
  mediaLayerInnerFillStyle,
  mediaChromeFillsMotionShell,
  mediaLayerOuterLayoutPair,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  widthFor,
} from '../styles';

export const fireMediaOnComplete = (ctx: Ctx, layer: LottieLayer | VideoLayer): void => {
  if (layer.loop !== false) return;
  const mode = layer.onComplete?.mode ?? 'none';
  if (mode === 'none' || !ctx.interactive) return;
  if (mode === 'next') ctx.onRespond?.({ kind: 'cta', action: 'primary' });
  else if (mode === 'screen' && layer.onComplete?.mode === 'screen')
    ctx.onRespond?.({ kind: 'go_to_screen', screenId: layer.onComplete.screenId });
};

export const ImageView = ({ layer, ctx }: { layer: ImageLayer; ctx: Ctx }) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedStyle = resolveImageStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const url = layer.media ? ctx.mediaMap?.[layer.media.mediaAssetId] : undefined;
  const hugWidth = resolvedStyle?.width === 'auto' || resolvedStyle?.width === undefined;
  const hugHeight = resolvedStyle?.height === 'auto' || resolvedStyle?.height === undefined;
  const useIntrinsicSize = hugWidth && hugHeight;
  const [intrinsicSize, setIntrinsicSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const { outerStyle, linearGradient } = mediaLayerOuterLayoutPair(
    resolvedStyle,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
    ctx.parentStackDirection,
  );
  const shellFill = mediaChromeFillsMotionShell(resolvedStyle, ctx.parentStackDirection);
  const placeholderBg = ctx.theme === 'dark' ? '#18181b' : '#f4f4f5';
  const hasAuthorBg =
    linearGradient != null || outerStyle.backgroundColor !== undefined;
  const innerStyle = {
    ...(useIntrinsicSize
      ? { borderRadius: outerStyle.borderRadius ?? 10 }
      : mediaLayerInnerFillStyle(resolvedStyle)),
    ...(!hasAuthorBg && !url ? { backgroundColor: placeholderBg } : {}),
  };
  const r = innerStyle.borderRadius as number | undefined;
  const resizeMode =
    (resolvedStyle?.fit ?? 'cover') === 'contain'
      ? 'contain'
      : (resolvedStyle?.fit ?? 'cover') === 'fill'
        ? 'stretch'
        : 'cover';
  const imageStyle = useIntrinsicSize
    ? {
        width: intrinsicSize?.width,
        height: intrinsicSize?.height,
        ...(r !== undefined ? { borderRadius: r } : {}),
      }
    : {
        width: '100%' as const,
        height: '100%' as const,
        ...(r !== undefined ? { borderRadius: r } : {}),
      };
  return (
    <ChromeView style={[outerStyle, shellFill]} linearGradient={linearGradient}>
      {url ? (
        <View style={innerStyle}>
          {isSvgMediaUrl(url) ? (
            <SvgUri
              uri={url}
              style={imageStyle}
              accessibilityLabel={layer.alt ?? undefined}
            />
          ) : (
            <Image
              source={{ uri: url }}
              accessibilityLabel={layer.alt ?? undefined}
              resizeMode={resizeMode}
              onLoad={(event) => {
                if (!useIntrinsicSize) return;
                const { width, height } = event.nativeEvent.source;
                if (width > 0 && height > 0) {
                  setIntrinsicSize({ width, height });
                }
              }}
              style={imageStyle}
            />
          )}
        </View>
      ) : (
        <View style={[innerStyle, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#71717a', fontSize: 11 }}>No media</Text>
        </View>
      )}
    </ChromeView>
  );
};

export const LottieLayerView = ({ layer, ctx }: { layer: LottieLayer; ctx: Ctx }) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedStyle = resolveImageStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const url = layer.media ? ctx.mediaMap?.[layer.media.mediaAssetId] : undefined;
  const playback = useMediaPlayback();
  const playSignal = useMediaPlaySignal(layer.id);
  const lottieRef = useRef<LottieView>(null);
  const completedRef = useRef(false);
  const shouldAutoplay = mediaAutoPlayOnMount(layer);
  const loopPlay = layer.loop !== false;
  const [playing, setPlaying] = useState(shouldAutoplay);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const play = useCallback(() => {
    if (playingRef.current) return;
    completedRef.current = false;
    setPlaying(true);
    lottieRef.current?.reset();
    lottieRef.current?.play();
  }, []);

  useEffect(() => {
    if (!playback) return;
    return playback.register(layer.id, { play });
  }, [playback, layer.id, play]);

  useEffect(() => {
    if (!shouldAutoplay) {
      setPlaying(false);
      lottieRef.current?.pause();
      return;
    }
    if (url) play();
  }, [shouldAutoplay, url, play, ctx.screen.id, layer.id]);

  useEffect(() => {
    if (shouldAutoplay || playSignal === 0) return;
    play();
  }, [playSignal, shouldAutoplay, play]);

  const { outerStyle, linearGradient } = mediaLayerOuterLayoutPair(
    resolvedStyle,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
    ctx.parentStackDirection,
  );
  const shellFill = mediaChromeFillsMotionShell(resolvedStyle, ctx.parentStackDirection);
  const placeholderBg = ctx.theme === 'dark' ? '#18181b' : '#f4f4f5';
  const hasAuthorBg =
    linearGradient != null || outerStyle.backgroundColor !== undefined;
  const innerStyle = {
    ...mediaLayerInnerFillStyle(resolvedStyle),
    borderRadius: outerStyle.borderRadius ?? 10,
    ...(!hasAuthorBg && !url ? { backgroundColor: placeholderBg } : {}),
  };
  const fit = resolvedStyle?.fit ?? 'contain';
  const resizeMode =
    fit === 'cover' ? 'cover' : fit === 'fill' ? 'cover' : 'contain';
  const r = innerStyle.borderRadius as number | undefined;
  return (
    <ChromeView style={[outerStyle, shellFill]} linearGradient={linearGradient}>
      {url ? (
        <View style={innerStyle}>
          <LottieView
            ref={lottieRef}
            source={{ uri: url }}
            autoPlay={playing}
            loop={loopPlay}
            resizeMode={resizeMode}
            onAnimationFinish={(isCancelled) => {
              if (isCancelled || loopPlay || completedRef.current) return;
              completedRef.current = true;
              fireMediaOnComplete(ctx, layer);
            }}
            style={{
              width: '100%',
              height: '100%',
              ...(r !== undefined ? { borderRadius: r } : {}),
            }}
          />
        </View>
      ) : (
        <View style={[innerStyle, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#71717a', fontSize: 11 }}>No media</Text>
        </View>
      )}
    </ChromeView>
  );
};

export const VideoLayerView = (props: VideoLayerViewProps) => {
  const { VideoLayerView: Impl } = getVideoAdapter();
  return <Impl {...props} />;
};

export const IconView = ({ layer, ctx }: { layer: IconLayer; ctx: Ctx }) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedStyle = resolveIconStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const rawH = resolvedStyle?.height;
  const rawW = resolvedStyle?.width;
  // Glyph fits the box (`min(width, height)`); no `style.size`.
  const glyphNum =
    typeof rawW === 'number' && typeof rawH === 'number'
      ? Math.max(8, Math.min(rawW, rawH))
      : typeof rawH === 'number'
        ? rawH
        : typeof rawW === 'number'
          ? rawW
          : 24;
  const color = resolveThemedColor(
    ctx.manifest.theme,
    ctx.theme,
    resolvedStyle?.color ?? DEFAULT_THEMED_FOREGROUND,
  ) as string;
  const chromePair = commonViewStylePair(
    stripCommonLayoutForInner(
      stripFlowAxesForFlexChild(resolvedStyle, ctx.parentStackDirection),
    ),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const isAbsolute = resolvedStyle?.position === 'absolute';
  const inFlex = ctx.parentStackDirection !== undefined;
  const directWidth = isAbsolute || inFlex ? undefined : widthFor(rawW);
  const directHeight = isAbsolute || inFlex ? undefined : layoutHeightFor(rawH);
  const wrapStyle: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    ...chromePair.style,
    ...(directWidth !== undefined ? { width: directWidth } : {}),
    ...(directHeight !== undefined ? { height: directHeight } : {}),
  };

  let glyph: ReactNode;
  if (layer.family === 'ionicons') {
    glyph = <Ionicons name={layer.iconName.trim()} size={glyphNum} color={color} />;
  } else {
    glyph = (
      <Text style={{ fontSize: 11, color, textAlign: 'center' }} numberOfLines={3}>
        {layer.iconName}
      </Text>
    );
  }

  return (
    <ChromeView style={wrapStyle} linearGradient={chromePair.linearGradient}>
      {glyph}
    </ChromeView>
  );
};
