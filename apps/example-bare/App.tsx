import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Flow } from '@getrheo/react-native-bare';
import {
  canStartExampleConfig,
  DEFAULT_API_URL,
  EXAMPLE_CONFIG_STORAGE_KEY,
  type SavedConfig,
} from './lib/exampleRheoConfig';
import { ManifestPrefetchPanel } from './lib/manifestPrefetchPanel';
import { RheoExampleShell, useExampleRheoShell } from './lib/rheoExampleShell';

const inputStyle = {
  backgroundColor: '#18181b',
  color: '#fafafa',
  padding: 12,
  borderRadius: 8,
  fontSize: 15,
  borderWidth: 1,
  borderColor: '#27272a',
};

const FlowHostHeader = ({ onBack }: { onBack: () => void }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#27272a',
      backgroundColor: '#0a0a0a',
    }}
  >
    <Pressable onPress={onBack} style={{ paddingVertical: 4, paddingRight: 12 }}>
      <Text style={{ color: '#a78bfa', fontSize: 16, fontWeight: '600' }}>‹ Config</Text>
    </Pressable>
    <Text style={{ color: '#fafafa', fontSize: 16, fontWeight: '600' }}>Flow</Text>
    <View style={{ width: 72 }} />
  </View>
);

const AppContent = () => {
  const { syncFromSavedConfig } = useExampleRheoShell();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [config, setConfig] = useState<SavedConfig>({
    publishableKey: '',
    channelId: '',
    apiBaseUrl: DEFAULT_API_URL,
    userId: 'example-user',
    hideFlowNavigationBar: false,
  });

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(EXAMPLE_CONFIG_STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as Partial<SavedConfig>;
          setConfig((prev) => ({
            ...prev,
            ...parsed,
            apiBaseUrl: parsed.apiBaseUrl || DEFAULT_API_URL,
            userId: parsed.userId || 'example-user',
            hideFlowNavigationBar: parsed.hideFlowNavigationBar ?? false,
          }));
        } catch {
          /* ignore */
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canStart = canStartExampleConfig(config);

  const start = useCallback(async () => {
    if (!canStart) return;
    await AsyncStorage.setItem(EXAMPLE_CONFIG_STORAGE_KEY, JSON.stringify(config));
    syncFromSavedConfig(config);
    setRunning(true);
  }, [canStart, config, syncFromSavedConfig]);

  const stopFlow = useCallback(() => {
    setRunning(false);
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (running && canStart) {
    const channelId = config.channelId.trim();
    const hideNav = config.hideFlowNavigationBar === true;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={hideNav ? undefined : ['top']}>
        {!hideNav ? <FlowHostHeader onBack={stopFlow} /> : null}
        <Flow
          channelId={channelId}
          onFlowCompleted={stopFlow}
          onFlowAbandoned={stopFlow}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '600' }}>
            Rheo bare example
          </Text>
          <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
            Uses `@getrheo/react-native-bare` (react-native-video + react-native-in-app-review).
            Generate `ios/` and `android/` with the React Native CLI before `run-ios` / `run-android`.
          </Text>
          <TextInput
            placeholder="Publishable key"
            placeholderTextColor="#71717a"
            value={config.publishableKey}
            onChangeText={(v) => setConfig((c) => ({ ...c, publishableKey: v }))}
            autoCapitalize="none"
            style={inputStyle}
          />
          <TextInput
            placeholder="Channel id"
            placeholderTextColor="#71717a"
            value={config.channelId}
            onChangeText={(v) => setConfig((c) => ({ ...c, channelId: v }))}
            autoCapitalize="none"
            style={inputStyle}
          />
          <TextInput
            placeholder="API base URL"
            placeholderTextColor="#71717a"
            value={config.apiBaseUrl}
            onChangeText={(v) => setConfig((c) => ({ ...c, apiBaseUrl: v }))}
            autoCapitalize="none"
            style={inputStyle}
          />
          <TextInput
            placeholder="User id"
            placeholderTextColor="#71717a"
            value={config.userId}
            onChangeText={(v) => setConfig((c) => ({ ...c, userId: v }))}
            autoCapitalize="none"
            style={inputStyle}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#27272a',
              backgroundColor: '#18181b',
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: '#fafafa', fontWeight: '600' }}>Hide navigation bar in flow</Text>
              <Text style={{ color: '#71717a', fontSize: 12 }}>
                Hides the host header (title and back) while the flow runs. Use for full-screen
                onboarding.
              </Text>
            </View>
            <Switch
              value={config.hideFlowNavigationBar === true}
              onValueChange={(v) => setConfig((c) => ({ ...c, hideFlowNavigationBar: v }))}
            />
          </View>
          <ManifestPrefetchPanel
            channelId={config.channelId}
            publishableKey={config.publishableKey}
            apiBaseUrl={config.apiBaseUrl}
            userId={config.userId}
            locale="en"
          />
          <Pressable
            onPress={start}
            disabled={!canStart}
            style={{
              backgroundColor: canStart ? '#6366f1' : '#3f3f46',
              padding: 14,
              borderRadius: 10,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ color: canStart ? '#fff' : '#a1a1aa', fontWeight: '600' }}>Start flow</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const App = () => (
  <SafeAreaProvider>
    <RheoExampleShell>
      <AppContent />
    </RheoExampleShell>
  </SafeAreaProvider>
);

export default App;
