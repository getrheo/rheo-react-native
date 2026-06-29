import type {ReactNode} from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Wraps the rendered flow screen in the chrome the SDK guarantees:
 * a `GestureHandlerRootView` (required for the renderer's `Gesture.Tap`
 * callbacks to fire on iOS) and an optional `KeyboardAvoidingView` so text
 * inputs don't get covered. Safe-area insets are not applied globally — enable
 * **Inset safe area** on a screen shell in the builder, or wrap `Flow` /
 * `LayerRenderer` in your own `SafeAreaView` when the manifest flag is off.
 * Avoid combining both on the same screen (double inset).
 */
export type ScreenChromeProps = {
  children: ReactNode;
  theme?: 'light' | 'dark';
  /** Disable when the host already provides a GestureHandlerRootView
   * (e.g. at the app root in `_layout.tsx`). */
  withGestureRoot?: boolean;
};

export const ScreenChrome = ({
  children,
  theme = 'dark',
  withGestureRoot = true,
}: ScreenChromeProps) => {
  const bg = theme === 'dark' ? '#0a0a0a' : '#ffffff';

  const inner = (
    <View style={{ flex: 1, width: '100%', backgroundColor: 'transparent' }}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Full-screen scroll belongs on the body region inside LayerRenderer,
            not here — an outer ScrollView merges header and body into one sheet. */}
        <View style={{ flex: 1, width: '100%' }}>{children}</View>
      </KeyboardAvoidingView>
    </View>
  );

  if (!withGestureRoot) return inner;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      {inner}
    </GestureHandlerRootView>
  );
};
