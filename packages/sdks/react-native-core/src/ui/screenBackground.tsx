import { Image, StyleSheet, View } from 'react-native';
import type { ImageStyle, ViewStyle } from 'react-native';
import { getVideoAdapter } from '../platform/videoAdapter.js';
import type { Screen, ScreenBackgroundFill } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  multiplyColorAlpha,
  nativeBrandBackgroundFromThemedColor,
  resolveScreenContainerStyleAtWidth,
  resolveThemedColor,
} from '@getrheo/flow-runtime';
import type { Ctx } from './LayerRendererShared';
import { ChromeView } from './LayerRendererShared';

const backdropLayout: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 0,
};

const imageResizeModeFor = (
  fit: 'cover' | 'contain' | 'fill' | undefined,
): 'cover' | 'contain' | 'stretch' => {
  if (fit === 'contain') return 'contain';
  if (fit === 'fill') return 'stretch';
  return 'cover';
};

const imageBackdropBase: ImageStyle = {
  ...StyleSheet.absoluteFillObject,
  zIndex: 0,
  width: '100%',
  height: '100%',
};

const ScrimOverlay = ({
  fill,
  ctx,
}: {
  fill: Extract<ScreenBackgroundFill, { kind: 'image' | 'video' }>;
  ctx: Ctx;
}) => {
  const scrim = fill.scrim;
  if (!scrim?.color && scrim?.opacity === undefined) return null;
  const raw = resolveThemedColor(ctx.manifest.theme, ctx.theme, scrim.color) as string | undefined;
  const bg = multiplyColorAlpha(raw ?? 'rgba(0,0,0,0.45)', scrim.opacity ?? 0.45);
  return (
    <View
      pointerEvents="none"
      style={{
        ...backdropLayout,
        zIndex: 1,
        backgroundColor: bg,
      }}
    />
  );
};

export const ScreenShellBackdrop = ({ screen, ctx }: { screen: Screen; ctx: Ctx }) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolved = resolveScreenContainerStyleAtWidth(
    screen.containerStyle,
    screen.containerStyleBreakpoints,
    w,
  );
  const fill = resolved?.backgroundFill;
  if (!fill) return null;

  if (fill.kind === 'color') {
    const nb = nativeBrandBackgroundFromThemedColor(
      ctx.manifest.theme,
      ctx.branding,
      ctx.theme,
      fill.color,
    );
    return (
      <ChromeView
        style={{
          ...backdropLayout,
          ...(nb.solid ? { backgroundColor: nb.solid } : {}),
        }}
        linearGradient={nb.linear ?? null}
      >
        <View style={{ flex: 1 }} />
      </ChromeView>
    );
  }

  const mediaId = fill.media?.mediaAssetId;
  const url = mediaId ? ctx.mediaMap?.[mediaId] : undefined;
  if (!url) return null;

  if (fill.kind === 'image') {
    return (
      <>
        <Image
          source={{ uri: url }}
          resizeMode={imageResizeModeFor(fill.fit)}
          style={{
            ...imageBackdropBase,
            opacity: fill.opacity ?? 1,
          }}
        />
        <ScrimOverlay fill={fill} ctx={ctx} />
      </>
    );
  }

  const { ScreenShellVideoBackdrop } = getVideoAdapter();
  return (
    <>
      <ScreenShellVideoBackdrop screenId={screen.id} url={url} fill={fill} ctx={ctx} />
      <ScrimOverlay fill={fill} ctx={ctx} />
    </>
  );
};
