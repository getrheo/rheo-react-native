import { View } from 'react-native';

export const useVideoPlayer = () => ({
  play: () => undefined,
  loop: false,
  muted: true,
});

export const VideoView = View;
