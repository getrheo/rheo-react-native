import { Branding } from '@getrheo/contracts/branding';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { ButtonAction, FlowManifest, Layer, Screen } from '@getrheo/contracts';
import type { InterpolationContext, StepResponse } from '@getrheo/flow-runtime';
import type { BrandGradientNativeLinear } from '@getrheo/flow-runtime';

export type Ctx = {
  manifest: FlowManifest;
  screen: Screen;
  locale: string;
  interactive: boolean;
  mediaMap?: Record<string, string>;
  onRespond?: (r: StepResponse) => void;
  onAction?: (
    a: ButtonAction,
    meta?: import('../useFlow/nativeButtonActionMeta.js').NativeButtonActionMeta,
  ) => void;
  theme: 'light' | 'dark';
  isRegionRoot?: boolean;
  regionKind?: 'header' | 'body' | 'footer';
  interpolationContext?: InterpolationContext;
  previewWidthPx?: number;
  onHyperlinkOpened?: (meta: { layerId: string; href: string }) => void;
  branding?: Branding;
  /** Parent stack main axis; used to map `width` / `height` presets onto the flex item wrapper. */
  parentStackDirection?: 'vertical' | 'horizontal';
  /** Cross-axis alignment of the immediate parent stack. */
  parentStackAlign?: 'start' | 'center' | 'end' | 'stretch';
  /** System Dynamic Type scale (`useWindowDimensions().fontScale`). */
  fontScale?: number;
};

export type RenderLayer = (layer: Layer, ctx: Ctx) => ReactNode;

export const GradientUnderlay = ({ spec }: { spec: BrandGradientNativeLinear }) => (
  <LinearGradient
    colors={spec.colors}
    locations={spec.locations}
    start={spec.start}
    end={spec.end}
    style={StyleSheet.absoluteFillObject}
    pointerEvents="none"
  />
);

export const ChromeView = ({
  style,
  linearGradient,
  children,
}: {
  style?: ViewStyle | ViewStyle[];
  linearGradient: BrandGradientNativeLinear | null;
  children: ReactNode;
}) => {
  if (!linearGradient) return <View style={style}>{children}</View>;
  const styleList = Array.isArray(style) ? style : [style];
  const allowOverflowVisible = styleList.some(
    (s) => s && typeof s === 'object' && (s as ViewStyle).overflow === 'visible',
  );
  return (
    <View style={[style, !allowOverflowVisible ? { overflow: 'hidden' } : {}]}>
      <GradientUnderlay spec={linearGradient} />
      {children}
    </View>
  );
};

export const ChoicePressable = ({
  onPress,
  disabled,
  children,
  style,
  linearGradient = null,
}: {
  onPress: () => void;
  disabled: boolean;
  children: ReactNode;
  style?: ViewStyle;
  linearGradient?: BrandGradientNativeLinear | null;
}) => {
  const pressed = useSharedValue(0);
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      pressed.value = withTiming(1, { duration: 80 });
    })
    .onFinalize(() => {
      pressed.value = withTiming(0, { duration: 120 });
    })
    .onEnd(() => {
      pressed.value = 0;
      runOnJS(onPress)();
    });
  const animatedStyle = useAnimatedStyle(() => {
    if (disabled) {
      return { transform: [{ scale: 1 }] };
    }
    return {
      transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.98]) }],
      opacity: interpolate(pressed.value, [0, 1], [1, 0.9]),
    };
  }, [disabled]);
  if (!linearGradient) {
    return (
      <GestureDetector gesture={tap}>
        <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
      </GestureDetector>
    );
  }
  const allowOverflowVisible = !!(style && typeof style === 'object' && style.overflow === 'visible');
  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={[style, animatedStyle, !allowOverflowVisible ? { overflow: 'hidden' } : {}]}
      >
        <GradientUnderlay spec={linearGradient} />
        {children}
      </Animated.View>
    </GestureDetector>
  );
};
