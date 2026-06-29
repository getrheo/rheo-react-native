import type {ReactNode} from 'react';
import type {ViewStyle} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import type { AnimationClip, RestingMotionEntry, Screen } from '@getrheo/contracts';

export type ControllerValue = {
  screen: Screen;
  clipsByLayer: Map<string, AnimationClip[]>;
  timelineMs: SharedValue<number>;
  durationMs: number;
};

export type MotionProviderProps = {
  screen: Screen;
  children: ReactNode;
};

export type LayerMotionShellProps = {
  layerId: string;
  restingMotionEntries: RestingMotionEntry[];
  layoutStyle?: ViewStyle;
  /** When true, stretch shell content on the main axis (web `renderLayer` height-fill wrapper). */
  heightFill?: boolean;
  children: ReactNode;
};
