import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RheoExampleShell } from '../lib/rheoExampleShell';

const RootLayout = () => {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RheoExampleShell>
          <Stack
            screenOptions={{
              contentStyle: { flex: 1, backgroundColor: '#0a0a0a' },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Rheo Example' }} />
            <Stack.Screen
              name="onboarding"
              options={{ title: 'Onboarding', headerBackTitle: 'Config' }}
            />
          </Stack>
          <StatusBar style="light" />
        </RheoExampleShell>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default RootLayout;
