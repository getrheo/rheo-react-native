import type { ComponentType } from 'react';
import type { ScreenBackgroundFill, VideoLayer } from '@getrheo/contracts';
import type { Ctx } from '../ui/LayerRendererShared.js';

export type VideoLayerViewProps = { layer: VideoLayer; ctx: Ctx };

export type ScreenShellVideoBackdropProps = {
  screenId: string;
  url: string;
  fill: Extract<ScreenBackgroundFill, { kind: 'video' }>;
  ctx: Ctx;
};

export type VideoAdapter = {
  VideoLayerView: ComponentType<VideoLayerViewProps>;
  ScreenShellVideoBackdrop: ComponentType<ScreenShellVideoBackdropProps>;
};

let videoAdapter: VideoAdapter | null = null;

export const registerVideoAdapter = (next: VideoAdapter): void => {
  videoAdapter = next;
};

export const getVideoAdapter = (): VideoAdapter => {
  if (!videoAdapter) {
    throw new Error(
      'Rheo video adapters are not registered. Import from @getrheo/react-native-expo or @getrheo/react-native-bare.',
    );
  }
  return videoAdapter;
};

export const __resetVideoAdapterForTests = (): void => {
  videoAdapter = null;
};

export const __setVideoAdapterForTests = (next: VideoAdapter | null): void => {
  videoAdapter = next;
};
