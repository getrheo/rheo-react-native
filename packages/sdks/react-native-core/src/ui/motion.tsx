/**
 * RN-side motion controller. One shared Reanimated timeline per screen;
 * each layer samples all clips at `timelineMs` for full timeline parity.
 */
export { MotionProvider, useController } from './motion/provider';
export { LayerMotionShell } from './motion/layerMotionShell';
export type { MotionProviderProps, LayerMotionShellProps } from './motion/types';
