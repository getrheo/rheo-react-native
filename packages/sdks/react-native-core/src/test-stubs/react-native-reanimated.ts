import { View } from 'react-native';

export const Easing = {
  linear: (t: number) => t,
  quad: (t: number) => t * t,
  inOut: (fn: (t: number) => number) => fn,
  bezier: () => (t: number) => t,
};

export const cancelAnimation = () => {};
export const interpolate = (value: number, input: number[], output: number[]) => {
  const [in0 = 0, in1 = 1] = input;
  const [out0 = 0, out1 = 1] = output;
  const t = in1 === in0 ? 0 : (value - in0) / (in1 - in0);
  return out0 + (out1 - out0) * t;
};
export const runOnJS = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
export const useAnimatedProps = (fn: () => unknown) => fn();
export const useAnimatedReaction = () => {};
export const useAnimatedStyle = (fn: () => unknown) => fn();
export const useSharedValue = <T,>(value: T) => ({ value });
export const withDelay = (_delay: number, value: unknown) => value;
export const withRepeat = (value: unknown) => value;
export const withTiming = (value: unknown) => value;

const Animated = {
  View,
  createAnimatedComponent: (component: unknown) => component,
};

export default Animated;
