import type {ReactNode} from 'react';

export const GestureHandlerRootView = (props: { children?: ReactNode }) =>
  props.children ?? null;

export const GestureDetector = (props: { children?: ReactNode }) => props.children ?? null;

const chain = {
  enabled: () => chain,
  onBegin: () => chain,
  onFinalize: () => chain,
  onEnd: () => chain,
};

export const Gesture = {
  Tap: () => chain,
};
