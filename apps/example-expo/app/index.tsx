import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createAttributionRuntime,
  getResolvedAppUserId,
  type AttributionRuntimeHandle,
} from '@getrheo/react-native-expo';
import { useFocusEffect, useRouter } from 'expo-router';
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

import { prepareAppsFlyerForFlow } from '../lib/appsFlyerBootstrap';
import { ManifestPrefetchPanel } from '../lib/manifestPrefetchPanel';
import { canStartExampleConfig, EXAMPLE_CONFIG_STORAGE_KEY, type SavedConfig } from '../lib/exampleRheoConfig';
import { useExampleRheoShell } from '../lib/rheoExampleShell';

const STORAGE_KEY = EXAMPLE_CONFIG_STORAGE_KEY;

/** Invalidates in-flight async attribution preview setup when blur or deps change. */
let attributionPreviewLatch = 0;

const formatAttrValue = (v: unknown): string => {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export type { SavedConfig } from '../lib/exampleRheoConfig';

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const envTrim = (v: string | undefined) => v?.trim() ?? '';

/** Mirrors `lib/appsFlyerBootstrap.ts` — env that would allow init on this platform (native only). */
const getAppsFlyerIntegrationDetected = () => {
  if (Platform.OS === 'web') {
    return {
      detected: false,
      hint: 'Native dev build only. Env keys apply on iOS/Android.',
    };
  }
  const devKey = envTrim(process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY);
  if (!devKey) {
    return { detected: false, hint: 'Set EXPO_PUBLIC_APPSFLYER_DEV_KEY in .env.' };
  }
  if (Platform.OS === 'ios' && !envTrim(process.env.EXPO_PUBLIC_APPSFLYER_IOS_APP_ID)) {
    return {
      detected: false,
      hint: 'Dev key set; add EXPO_PUBLIC_APPSFLYER_IOS_APP_ID for iOS.',
    };
  }
  return {
    detected: true,
    hint: 'Dev key ready for this platform (use a dev build, not Expo Go).',
  };
};

/** Mirrors `lib/revenueCatBootstrap.ts` — public SDK key for the current platform. */
const getRevenueCatIntegrationDetected = () => {
  if (Platform.OS === 'web') {
    return {
      detected: false,
      hint: 'Native dev build only. Set platform keys for iOS/Android.',
    };
  }
  const key =
    Platform.OS === 'ios'
      ? envTrim(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY)
      : envTrim(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY);
  if (!key) {
    return {
      detected: false,
      hint:
        Platform.OS === 'ios'
          ? 'Set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in .env.'
          : 'Set EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY in .env.',
    };
  }
  return {
    detected: true,
    hint: 'SDK key present for this platform (use a dev build, not Expo Go).',
  };
};

const IntegrationCheckRow = ({
  name,
  detected,
  hint,
}: {
  name: string;
  detected: boolean;
  hint: string;
}) => (
  <View style={{ gap: 4 }}>
    <Text style={{ color: '#fafafa', fontSize: 14, fontWeight: '600' }}>
      {name}:{' '}
      <Text style={{ color: detected ? '#86efac' : '#a1a1aa', fontWeight: '700' }}>
        {detected ? 'Detected' : 'Not detected'}
      </Text>
    </Text>
    <Text style={{ color: '#71717a', fontSize: 12 }}>{hint}</Text>
  </View>
);

const AttributionPreviewPanel = ({
  entries,
  webHint,
}: {
  entries: [string, unknown][];
  webHint?: string;
}) => (
  <View
    style={{
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#27272a',
      backgroundColor: '#18181b',
    }}
  >
    <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600' }}>
      Attribution data (SDK flat keys)
    </Text>
    <Text style={{ color: '#71717a', fontSize: 12 }}>
      Same shape as merged into decision{' '}
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
        sdkAttributes
      </Text>{' '}
      from the MMP runtime (
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
        flattenAttributionSnapshotToSdkAttributes
      </Text>
      ). Subscribes only while this screen is focused so we do not stack duplicate
      AppsFlyer listeners with the onboarding route.
    </Text>
    {webHint ? (
      <Text style={{ color: '#71717a', fontSize: 12 }}>{webHint}</Text>
    ) : entries.length === 0 ? (
      <Text style={{ color: '#71717a', fontSize: 12 }}>
        No keys yet — organic / no payload, or wait for install conversion / deep link.
        A prior session may hydrate from the device cache (24h TTL, namespaced by user id).
      </Text>
    ) : (
      <View style={{ gap: 8 }}>
        {entries.map(([k, v]) => (
          <View key={k} style={{ gap: 2 }}>
            <Text
              style={{
                color: '#a78bfa',
                fontSize: 11,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              }}
              selectable
            >
              {k}
            </Text>
            <Text style={{ color: '#e4e4e7', fontSize: 13 }} selectable>
              {formatAttrValue(v)}
            </Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'none',
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences';
  hint?: string;
}) => (
  <View style={{ gap: 6 }}>
    <Text style={{ color: '#fafafa', fontWeight: '600' }}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#52525b"
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      style={{
        backgroundColor: '#18181b',
        color: '#fafafa',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#27272a',
        fontSize: 14,
      }}
    />
    {hint ? (
      <Text style={{ color: '#71717a', fontSize: 12 }}>{hint}</Text>
    ) : null}
  </View>
);

const ConfigScreen = () => {
  const router = useRouter();
  const { syncFromSavedConfig, clearShell } = useExampleRheoShell();
  const [loading, setLoading] = useState(true);
  const [attrPreviewFlat, setAttrPreviewFlat] = useState<Record<string, unknown>>({});
  const [config, setConfig] = useState<SavedConfig>({
    publishableKey: '',
    channelId: '',
    apiBaseUrl: DEFAULT_API_URL,
    userId: 'example-user',
    useResolveFallback: true,
    hideFlowNavigationBar: false,
  });

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<SavedConfig>;
            setConfig((prev) => ({
              ...prev,
              ...parsed,
              apiBaseUrl: parsed.apiBaseUrl || DEFAULT_API_URL,
              useResolveFallback: parsed.useResolveFallback ?? true,
              hideFlowNavigationBar: parsed.hideFlowNavigationBar ?? false,
            }));
          } catch {
            /* ignore parse errors */
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (loading || Platform.OS === 'web') {
        setAttrPreviewFlat({});
        return () => {};
      }

      const token = ++attributionPreviewLatch;
      let rt: AttributionRuntimeHandle | undefined;
      let unsub: (() => void) | undefined;

      void (async () => {
        const uid = config.userId.trim() || 'example-user';
        await prepareAppsFlyerForFlow(uid);
        if (token !== attributionPreviewLatch) return;
        rt = createAttributionRuntime({
          enabled: true,
          storageNamespace: getResolvedAppUserId({ userId: uid }),
        });
        unsub = rt.subscribe((flat) => {
          if (token === attributionPreviewLatch) {
            setAttrPreviewFlat({ ...flat });
          }
        });
      })();

      return () => {
        attributionPreviewLatch += 1;
        unsub?.();
        rt?.dispose();
        setAttrPreviewFlat({});
      };
    }, [loading, config.userId]),
  );

  const canStart = canStartExampleConfig(config);

  const start = async () => {
    if (!canStart) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    syncFromSavedConfig(config);
    router.push('/onboarding');
  };

  const reset = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    clearShell();
    setConfig({
      publishableKey: '',
      channelId: '',
      apiBaseUrl: DEFAULT_API_URL,
      userId: 'example-user',
      useResolveFallback: true,
      hideFlowNavigationBar: false,
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const appsFlyerStatus = getAppsFlyerIntegrationDetected();
  const revenueCatStatus = getRevenueCatIntegrationDetected();
  const attrEntries = Object.entries(attrPreviewFlat).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: '#fafafa', fontSize: 22, fontWeight: '700' }}>
          Test the Rheo SDK
        </Text>

        <View
          style={{
            gap: 14,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: '#18181b',
          }}
        >
          <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600' }}>
            Native integrations (from .env at build time)
          </Text>
          <IntegrationCheckRow
            name="AppsFlyer"
            detected={appsFlyerStatus.detected}
            hint={appsFlyerStatus.hint}
          />
          <IntegrationCheckRow
            name="RevenueCat"
            detected={revenueCatStatus.detected}
            hint={revenueCatStatus.hint}
          />
        </View>

        <AttributionPreviewPanel
          entries={attrEntries}
          webHint={
            Platform.OS === 'web'
              ? 'Native iOS/Android dev builds only — web has no AppsFlyer / attribution runtime preview here.'
              : undefined
          }
        />

        <ManifestPrefetchPanel
          channelId={config.channelId}
          publishableKey={config.publishableKey}
          apiBaseUrl={config.apiBaseUrl}
          userId={config.userId}
          locale="en"
        />

        <Field
          label="Publishable key"
          value={config.publishableKey}
          onChangeText={(v) => setConfig((c) => ({ ...c, publishableKey: v }))}
          placeholder="ob_pk_test_..."
        />

        <Field
          label="Channel id"
          value={config.channelId}
          onChangeText={(v) => setConfig((c) => ({ ...c, channelId: v }))}
          placeholder="ch_test_..."
        />

        <Field
          label="API base URL"
          value={config.apiBaseUrl}
          onChangeText={(v) => setConfig((c) => ({ ...c, apiBaseUrl: v }))}
          placeholder="http://localhost:4000"
          hint="iOS simulator: http://localhost:4000. Android emulator: http://10.0.2.2:4000."
        />

        <Field
          label="User id"
          value={config.userId}
          onChangeText={(v) => setConfig((c) => ({ ...c, userId: v }))}
          placeholder="example-user"
          hint="Forwarded as identity.appUserId on every event."
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
              Hides the Expo Router stack header (title and back button) while the flow is
              running. Use for full-screen onboarding.
            </Text>
          </View>
          <Switch
            value={config.hideFlowNavigationBar === true}
            onValueChange={(v) => setConfig((c) => ({ ...c, hideFlowNavigationBar: v }))}
          />
        </View>

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
            <Text style={{ color: '#fafafa', fontWeight: '600' }}>Offline resolve fallback</Text>
            <Text style={{ color: '#71717a', fontSize: 12 }}>
              When resolve fails, show hardcoded example UI instead of the SDK default error.
              Turn off to see &quot;Error to load the content&quot; + Try again.
            </Text>
          </View>
          <Switch
            value={config.useResolveFallback !== false}
            onValueChange={(v) => setConfig((c) => ({ ...c, useResolveFallback: v }))}
          />
        </View>

        <Pressable
          onPress={start}
          disabled={!canStart}
          style={({ pressed }) => ({
            marginTop: 12,
            paddingVertical: 14,
            borderRadius: 10,
            backgroundColor: canStart ? '#fafafa' : '#3f3f46',
            opacity: pressed ? 0.85 : 1,
            alignItems: 'center',
          })}
        >
          <Text
            style={{
              color: canStart ? '#0a0a0a' : '#a1a1aa',
              fontWeight: '700',
            }}
          >
            Start flow
          </Text>
        </Pressable>

        <Pressable onPress={reset} style={{ alignItems: 'center', padding: 8 }}>
          <Text style={{ color: '#71717a', fontSize: 13 }}>Reset config</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ConfigScreen;
