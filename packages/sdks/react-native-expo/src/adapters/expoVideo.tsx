import { useCallback, useEffect, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { VideoView, useVideoPlayer, type VideoContentFit } from 'expo-video';
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

const videoContentFitFor = (
  fit: 'cover' | 'contain' | 'fill' | undefined,
): VideoContentFit => {
  if (fit === 'contain') return 'contain';
  if (fit === 'fill') return 'fill';
  return 'cover';
};

export const ExpoVideoLayerView = ({ layer, ctx }: VideoLayerViewProps) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedStyle = resolveImageStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const url = layer.media ? ctx.mediaMap?.[layer.media.mediaAssetId] : undefined;
  const playback = useMediaPlayback();
  const playSignal = useMediaPlaySignal(layer.id);
  const completedRef = useRef(false);
  const manualPlayRef = useRef(false);
  const shouldAutoplay = mediaAutoPlayOnMount(layer);
  const loopPlay = layer.loop !== false;
  const muted = layer.audioEnabled !== true;

  const player = useVideoPlayer(url ?? null, (p) => {
    p.loop = loopPlay;
    p.muted = muted;
    if (!shouldAutoplay) {
      p.pause();
      try {
        p.currentTime = 0;
      } catch {
        // metadata not ready
      }
    }
  });

  const pauseAtStart = useCallback((): void => {
    try {
      player.pause();
      player.currentTime = 0;
    } catch {
      // player not ready
    }
  }, [player]);

  const play = useCallback(() => {
    if (player.playing) return;
    completedRef.current = false;
    manualPlayRef.current = true;
    try {
      player.currentTime = 0;
    } catch {
      // metadata not ready
    }
    void player.play();
  }, [player]);

  useEffect(() => {
    if (!playback) return;
    return playback.register(layer.id, { play });
  }, [playback, layer.id, play]);

  useEffect(() => {
    player.loop = loopPlay;
    player.muted = muted;
  }, [loopPlay, muted, player]);

  useEffect(() => {
    if (!url) return;
    if (!shouldAutoplay) {
      manualPlayRef.current = false;
      pauseAtStart();
      return;
    }
    void player.play();
  }, [shouldAutoplay, url, player, ctx.screen.id, layer.id, pauseAtStart]);

  useEffect(() => {
    if (shouldAutoplay || playSignal === 0 || !url) return;
    play();
  }, [playSignal, shouldAutoplay, play, url]);

  useEffect(() => {
    if (shouldAutoplay || !url) return;
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying && !manualPlayRef.current) {
        player.pause();
        try {
          player.currentTime = 0;
        } catch {
          // metadata not ready
        }
      }
      if (!isPlaying) manualPlayRef.current = false;
    });
    return () => sub.remove();
  }, [shouldAutoplay, url, player]);

  useEffect(() => {
    if (!ctx.interactive || loopPlay) return;
    const sub = player.addListener('playToEnd', () => {
      if (completedRef.current) return;
      completedRef.current = true;
      fireMediaOnComplete(ctx, layer);
    });
    return () => sub.remove();
  }, [ctx, layer, loopPlay, player]);

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
  const fit = resolvedStyle?.fit ?? 'contain';
  const contentFit =
    fit === 'cover' ? 'cover' : fit === 'fill' ? 'fill' : 'contain';
  const r = innerStyle.borderRadius as number | undefined;

  return (
    <ChromeView style={outerStyle} linearGradient={linearGradient}>
      {url ? (
        <View style={innerStyle}>
          <VideoView
            player={player}
            contentFit={contentFit}
            nativeControls={false}
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

export const ExpoScreenShellVideoBackdrop = ({
  screenId,
  url,
  fill,
  ctx,
}: ScreenShellVideoBackdropProps) => {
  const playbackId = screenBackgroundPlaybackId(screenId);
  const playback = useMediaPlayback();
  const playSignal = useMediaPlaySignal(playbackId);
  const completedRef = useRef(false);
  const manualPlayRef = useRef(false);
  const shouldAutoplay = mediaAutoPlayOnMount(fill);
  const loopPlay = fill.loop !== false;
  const muted = fill.audioEnabled !== true;

  const player = useVideoPlayer(url, (p) => {
    p.loop = loopPlay;
    p.muted = muted;
    if (!shouldAutoplay) {
      p.pause();
      try {
        p.currentTime = 0;
      } catch {
        // not ready
      }
    }
  });

  const pauseAtStart = useCallback((): void => {
    try {
      player.pause();
      player.currentTime = 0;
    } catch {
      // not ready
    }
  }, [player]);

  const play = useCallback((): void => {
    if (player.playing) return;
    completedRef.current = false;
    manualPlayRef.current = true;
    try {
      player.currentTime = 0;
    } catch {
      // not ready
    }
    void player.play();
  }, [player]);

  useEffect(() => {
    if (!playback) return;
    return playback.register(playbackId, { play });
  }, [playback, playbackId, play]);

  useEffect(() => {
    player.loop = loopPlay;
    player.muted = muted;
  }, [loopPlay, muted, player]);

  useEffect(() => {
    if (!shouldAutoplay) {
      manualPlayRef.current = false;
      pauseAtStart();
      return;
    }
    void player.play();
  }, [shouldAutoplay, url, player, pauseAtStart]);

  useEffect(() => {
    if (shouldAutoplay || playSignal === 0 || !url) return;
    play();
  }, [playSignal, shouldAutoplay, play, url]);

  useEffect(() => {
    if (!ctx.interactive || loopPlay) return;
    const sub = player.addListener('playToEnd', () => {
      if (completedRef.current) return;
      completedRef.current = true;
      const mode = fill.onComplete?.mode ?? 'none';
      if (mode === 'next') ctx.onRespond?.({ kind: 'cta', action: 'primary' });
    });
    return () => sub.remove();
  }, [ctx, fill.onComplete, loopPlay, player]);

  return (
    <View style={backdropLayout} pointerEvents="none" collapsable={false}>
      <VideoView
        player={player}
        pointerEvents="none"
        {...(Platform.OS === 'android' ? { surfaceType: 'textureView' as const } : {})}
        style={{
          width: '100%',
          height: '100%',
          opacity: fill.opacity ?? 1,
        }}
        contentFit={videoContentFitFor(fill.fit)}
        nativeControls={false}
      />
    </View>
  );
};
