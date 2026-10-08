import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { FlowManifest } from '@getrheo/contracts';
import { LayerRenderer } from '../ui/index.js';
import { useBanner } from './useBanner.js';

export type RheoBannerProps = {
  channelId: string;
  theme?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  previewWidthPx?: number;
};

export const RheoBanner = ({
  channelId,
  theme = 'light',
  style,
  previewWidthPx,
}: RheoBannerProps) => {
  const { loading, banner, dismissed, dismiss } = useBanner({ channelId });
  const [layoutWidth, setLayoutWidth] = useState<number | undefined>(undefined);

  if (loading || !banner || banner.control || dismissed) return null;

  const sizing = banner.manifest.sizing;
  const availableWidth = previewWidthPx ?? layoutWidth ?? (sizing.mode === 'fixed' ? sizing.width : 320);

  const boxStyle: ViewStyle =
    sizing.mode === 'fixed'
      ? { width: sizing.width, height: sizing.height, overflow: 'hidden' }
      : {
          width: '100%',
          maxWidth: sizing.maxWidth,
          minHeight: sizing.minHeight,
          maxHeight: sizing.maxHeight,
        };

  const previewWidth =
    sizing.mode === 'responsive'
      ? Math.min(availableWidth, sizing.maxWidth ?? availableWidth)
      : sizing.width;

  const manifest = banner.manifest as unknown as FlowManifest;

  return (
    <View
      style={[boxStyle, style]}
      onLayout={(e) => {
        if (previewWidthPx != null) return;
        const width = e.nativeEvent.layout.width;
        if (width > 0) setLayoutWidth(width);
      }}
    >
      <LayerRenderer
        manifest={manifest}
        screen={banner.manifest.rootScreen}
        mediaMap={banner.mediaMap}
        branding={banner.branding}
        theme={theme}
        interactive
        onAction={(action) => {
          if (action.kind === 'dismiss_banner') dismiss();
        }}
      />
    </View>
  );
};
