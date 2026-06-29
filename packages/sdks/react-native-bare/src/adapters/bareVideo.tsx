import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Video, { type OnVideoErrorData, type VideoRef } from 'react-native-video';
import { screenBackgroundPlaybackId } from '@getrheo/contracts';
import { DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX, resolveImageStyleAtWidth } from '@getrheo/flow-runtime';
import { ChromeView } from '@getrheo/react-native-core/ui/LayerRendererShared';
import {
  mediaAutoPlayOnMount,
  useMediaPlayback,
  useMediaPlaySignal,
} from '@getrheo/react-native-core/ui/mediaPlayback';
import {
  mediaLayerInnerFillStyle,
  mediaLayerOuterLayoutPair,
} from '@getrheo/react-native-core/ui/styles';
import { fireMediaOnComplete } from '@getrheo/react-native-core/ui/layers/mediaLayers';
import type {
  ScreenShellVideoBackdropProps,
  VideoLayerViewProps,
} from '@getrheo/react-native-core/platform';

const backdropLayout: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 0,
};

const resizeModeFor = (
  fit: 'cover' | 'contain' | 'fill' | undefined,
): 'cover' | 'contain' | 'stretch' => {
  if (fit === 'contain') return 'contain';
  if (fit === 'fill') return 'stretch';
  return 'cover';
};

const useBareVideoPlayback = ({
  url,
  layerId,
  shouldAutoplay,
  loopPlay,
  muted,
  onPlayToEnd,
}: {
  url: string | undefined;
  layerId: string;
  shouldAutoplay: boolean;
  loopPlay: boolean;
  muted: boolean;
  onPlayToEnd?: () => void;
}) => {
  const videoRef = useRef<VideoRef>(null);
  const playback = useMediaPlayback();
  const playSignal = useMediaPlaySignal(layerId);
  const completedRef = useRef(false);
  const [paused, setPaused] = useState(!shouldAutoplay || !url);

  const play = useCallback(() => {
    completedRef.current = false;
    setPaused(false);
    videoRef.current?.seek(0);
  }, []);

  useEffect(() => {
    if (!playback) return;
    return playback.register(layerId, { play });
  }, [playback, layerId, play]);

  useEffect(() => {
    setPaused(!shouldAutoplay || !url);
  }, [shouldAutoplay, url]);

  useEffect(() => {
    if (shouldAutoplay || playSignal === 0 || !url) return;
    play();
  }, [playSignal, shouldAutoplay, play, url]);

  const onEnd = useCallback(() => {
    if (loopPlay || completedRef.current) return;
    completedRef.current = true;
    onPlayToEnd?.();
  }, [loopPlay, onPlayToEnd]);

  const onError = useCallback((_e: OnVideoErrorData) => {
    setPaused(true);
  }, []);

  return {
    videoRef,
    paused,
    play,
    onEnd,
    onError,
    loopPlay,
    muted,
  };
};

export const BareVideoLayerView = ({ layer, ctx }: VideoLayerViewProps) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedStyle = resolveImageStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const url = layer.media ? ctx.mediaMap?.[layer.media.mediaAssetId] : undefined;
  const shouldAutoplay = mediaAutoPlayOnMount(layer);
  const loopPlay = layer.loop !== false;
  const muted = layer.audioEnabled !== true;

  const { videoRef, paused, onEnd, onError, loopPlay: loop, muted: isMuted } =
    useBareVideoPlayback({
      url,
      layerId: layer.id,
      shouldAutoplay,
      loopPlay,
      muted,
      onPlayToEnd: () => fireMediaOnComplete(ctx, layer),
    });

  const { outerStyle, linearGradient } = mediaLayerOuterLayoutPair(
    resolvedStyle,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const placeholderBg = ctx.theme === 'dark' ? '#18181b' : '#f4f4f5';
  const hasAuthorBg =
    linearGradient != null || outerStyle.backgroundColor !== undefined;
  const innerStyle = {
    ...mediaLayerInnerFillStyle(resolvedStyle),
    borderRadius: outerStyle.borderRadius ?? 10,
    ...(!hasAuthorBg && !url ? { backgroundColor: placeholderBg } : {}),
  };
  const r = innerStyle.borderRadius as number | undefined;
  const resizeMode = resizeModeFor(resolvedStyle?.fit ?? 'contain');

  return (
    <ChromeView style={outerStyle} linearGradient={linearGradient}>
      {url ? (
        <View style={innerStyle}>
          <Video
            ref={videoRef}
            source={{ uri: url }}
            style={{
              width: '100%',
              height: '100%',
              ...(r !== undefined ? { borderRadius: r } : {}),
            }}
            resizeMode={resizeMode}
            repeat={loop}
            muted={isMuted}
            paused={paused}
            onEnd={onEnd}
            onError={onError}
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

export const BareScreenShellVideoBackdrop = ({
  screenId,
  url,
  fill,
  ctx,
}: ScreenShellVideoBackdropProps) => {
  const shouldAutoplay = mediaAutoPlayOnMount(fill);
  const loopPlay = fill.loop !== false;
  const muted = fill.audioEnabled !== true;
  const playbackId = screenBackgroundPlaybackId(screenId);

  const { videoRef, paused, onEnd, onError, loopPlay: loop, muted: isMuted } =
    useBareVideoPlayback({
      url,
      layerId: playbackId,
      shouldAutoplay,
      loopPlay,
      muted,
      onPlayToEnd: () => {
        const mode = fill.onComplete?.mode ?? 'none';
        if (mode === 'next') ctx.onRespond?.({ kind: 'cta', action: 'primary' });
      },
    });

  return (
    <View style={backdropLayout} pointerEvents="none" collapsable={false}>
      <Video
        ref={videoRef}
        source={{ uri: url }}
        style={{
          width: '100%',
          height: '100%',
          opacity: fill.opacity ?? 1,
        }}
        resizeMode={resizeModeFor(fill.fit)}
        repeat={loop}
        muted={isMuted}
        paused={paused}
        onEnd={onEnd}
        onError={onError}
      />
    </View>
  );
};
