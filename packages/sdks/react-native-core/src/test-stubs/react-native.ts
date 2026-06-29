/** Minimal stubs so Vitest never loads upstream `react-native` (Metro uses the real package). */
import type {ReactNode} from 'react';

export const Platform = {
  OS: 'ios' as const,
  select: <T,>(opts: Record<string, T>): T =>
    (opts as Record<string, T | undefined>).ios ??
    (opts as Record<string, T | undefined>).default!,
};

const Passthrough = (props: { children?: ReactNode; style?: unknown }) => props.children ?? null;

export const View = Passthrough;
export const Text = Passthrough;
export const TextInput = Passthrough;
export const ScrollView = Passthrough;
export const KeyboardAvoidingView = Passthrough;
export const Pressable = Passthrough;
export const ActivityIndicator = Passthrough;

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  hairlineWidth: 1,
};

export const useWindowDimensions = () => ({
  width: 393,
  height: 852,
  scale: 3,
  fontScale: 1,
});

export type NativeScrollEvent = Record<string, never>;
export type NativeSyntheticEvent<T> = { nativeEvent: T };
export type ViewStyle = Record<string, unknown>;
