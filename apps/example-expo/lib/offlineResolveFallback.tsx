import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const STEPS = [
  {
    title: 'Offline onboarding',
    body: 'Rheo could not load your flow from the API. This screen is hardcoded in the example app — your escape hatch when resolve fails.',
  },
  {
    title: 'Ship your own flow',
    body: 'Pass a `fallback` prop to `<Flow />` with any React UI you want (static screens, local navigation, etc.). Rheo does not emit events on this surface.',
  },
  {
    title: 'Try again later',
    body: 'Remount this screen or fix the API URL on the config screen when your backend is reachable again.',
  },
] as const;

export type OfflineResolveFallbackProps = {
  theme: 'light' | 'dark';
  onExit: () => void;
};

export const OfflineResolveFallback = ({ theme, onExit }: OfflineResolveFallbackProps) => {
  const [step, setStep] = useState(0);
  const isDark = theme === 'dark';
  const fg = isDark ? '#fafafa' : '#0a0a0a';
  const muted = isDark ? '#a1a1aa' : '#71717a';
  const cardBg = isDark ? '#18181b' : '#f4f4f5';
  const buttonBg = isDark ? '#fafafa' : '#0a0a0a';
  const buttonFg = isDark ? '#0a0a0a' : '#fafafa';
  const content = STEPS[step]!;
  const isLast = step >= STEPS.length - 1;

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 24 }}>
      <View style={{ gap: 12, padding: 20, borderRadius: 12, backgroundColor: cardBg }}>
        <Text style={{ color: muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 }}>
          EXAMPLE · RESOLVE FALLBACK
        </Text>
        <Text style={{ color: fg, fontSize: 22, fontWeight: '700' }}>{content.title}</Text>
        <Text style={{ color: muted, fontSize: 15, lineHeight: 22 }}>{content.body}</Text>
        <Text style={{ color: muted, fontSize: 12 }}>
          Step {step + 1} of {STEPS.length}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (isLast) onExit();
          else setStep((s) => s + 1);
        }}
        style={({ pressed }) => ({
          paddingVertical: 14,
          borderRadius: 10,
          backgroundColor: buttonBg,
          opacity: pressed ? 0.85 : 1,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: buttonFg, fontWeight: '700', fontSize: 16 }}>
          {isLast ? 'Back to config' : 'Continue'}
        </Text>
      </Pressable>
    </View>
  );
};
