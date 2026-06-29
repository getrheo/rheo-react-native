import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import {
  FlowTerminalSnapshot,
  Flow,
  type EmailPasswordAuthHandlerPayload,
  type OAuthLoginHandlerPayload,
} from '@getrheo/react-native-expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineResolveFallback } from '../lib/offlineResolveFallback';
import { prepareAppsFlyerForFlow } from '../lib/appsFlyerBootstrap';
import { prepareRevenueCatForFlow } from '../lib/revenueCatBootstrap';
import {
  EXAMPLE_CONFIG_STORAGE_KEY,
  type SavedConfig,
} from '../lib/exampleRheoConfig';

const OnboardingRoute = () => {
  const colorScheme = useColorScheme();
  const rheoTheme = colorScheme === 'light' ? 'light' : 'dark';
  const router = useRouter();
  const [bundle, setBundle] = useState<{
    channelId: string;
    useResolveFallback: boolean;
    hideFlowNavigationBar: boolean;
  } | null>(null);
  const navigation = useNavigation();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(EXAMPLE_CONFIG_STORAGE_KEY).then(async (raw) => {
      if (!raw) {
        setMissing(true);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as SavedConfig;
        if (!parsed.publishableKey || !parsed.channelId || !parsed.apiBaseUrl) {
          setMissing(true);
          return;
        }
        try {
          await prepareRevenueCatForFlow(parsed.userId || 'example-user');
        } catch (err) {
          console.warn('[rheo-example] RevenueCat bootstrap failed:', err);
        }
        try {
          await prepareAppsFlyerForFlow(parsed.userId || 'example-user');
        } catch (err) {
          console.warn('[rheo-example] AppsFlyer bootstrap failed:', err);
        }
        setBundle({
          channelId: parsed.channelId.trim(),
          useResolveFallback: parsed.useResolveFallback !== false,
          hideFlowNavigationBar: parsed.hideFlowNavigationBar === true,
        });
      } catch {
        setMissing(true);
      }
    });
  }, []);

  useEffect(() => {
    if (missing) router.replace('/');
  }, [missing, router]);

  useEffect(() => {
    if (!bundle) return;
    const immersive = bundle.hideFlowNavigationBar;
    navigation.setOptions({
      headerShown: !immersive,
      ...(immersive
        ? { contentStyle: { flex: 1, backgroundColor: 'transparent' } }
        : {}),
    });
  }, [bundle, navigation]);

  const handleFlowCompleted = useCallback((payload: FlowTerminalSnapshot) => {
    console.log('Flow completed:', payload);
    router.replace('/');
  }, [router]);

  const handleOAuthLogin = useCallback((p: OAuthLoginHandlerPayload) => {
    console.log('[rheo-example] OAuth tap', p.provider, p.screenId);
    setTimeout(() => {
      p.resolve({ success: true, customerExternalId: `example_${p.provider}` });
    }, 350);
  }, []);

  const handleEmailPasswordAuth = useCallback((p: EmailPasswordAuthHandlerPayload) => {
    console.log('[rheo-example] Email/password', p.mode, p.screenId);
    setTimeout(() => {
      p.resolve({ success: true });
    }, 250);
  }, []);

  if (!bundle) {
    return (
      <View
        style={{
          flex: 1,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator />
        <Text style={{ color: '#a1a1aa', marginTop: 12 }}>Loading config…</Text>
      </View>
    );
  }

  const { channelId, useResolveFallback, hideFlowNavigationBar } = bundle;

  const offlineFallback = useResolveFallback ? (
    <OfflineResolveFallback theme={rheoTheme} onExit={() => router.replace('/')} />
  ) : undefined;

  const flow = (
    <View style={{ flex: 1, width: '100%' }}>
      <Flow
        channelId={channelId}
        theme={rheoTheme}
        fallback={offlineFallback}
        withGestureRoot={false}
        locale="en"
        onFlowCompleted={handleFlowCompleted}
        onOAuthLogin={handleOAuthLogin}
        onEmailPasswordAuth={handleEmailPasswordAuth}
      />
    </View>
  );

  return hideFlowNavigationBar ? (
    <>
      <StatusBar style={rheoTheme === 'dark' ? 'light' : 'dark'} />
      {flow}
    </>
  ) : (
    <SafeAreaView
      style={{ flex: 1, width: '100%', alignSelf: 'stretch' }}
      edges={['right', 'bottom', 'left']}
    >
      {flow}
    </SafeAreaView>
  );
};

export default OnboardingRoute;
