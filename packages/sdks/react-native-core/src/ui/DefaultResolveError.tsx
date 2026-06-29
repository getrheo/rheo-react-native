import { Pressable, StyleSheet, Text, View } from 'react-native';

export const DEFAULT_RESOLVE_ERROR_TITLE = 'Error to load the content';
export const DEFAULT_RESOLVE_ERROR_RETRY_LABEL = 'Try again';

export type DefaultResolveErrorProps = {
  theme?: 'light' | 'dark';
  onRetry: () => void;
};

export const DefaultResolveError = ({
  theme = 'light',
  onRetry,
}: DefaultResolveErrorProps) => {
  const isDark = theme === 'dark';
  const fg = isDark ? '#fafafa' : '#0a0a0a';
  const muted = isDark ? '#a1a1aa' : '#71717a';
  const buttonBg = isDark ? '#fafafa' : '#0a0a0a';
  const buttonFg = isDark ? '#0a0a0a' : '#fafafa';

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: fg }]}>{DEFAULT_RESOLVE_ERROR_TITLE}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={DEFAULT_RESOLVE_ERROR_RETRY_LABEL}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: buttonBg, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.buttonLabel, { color: buttonFg }]}>
          {DEFAULT_RESOLVE_ERROR_RETRY_LABEL}
        </Text>
      </Pressable>
      <Text style={[styles.hint, { color: muted }]}>
        Check your connection and try again.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});
