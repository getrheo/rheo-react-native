import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PushTokenAdapter } from '@getrheo/react-native-core/platform';

export const expoPushTokenAdapter: PushTokenAdapter = {
  getDevicePushToken: async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
    try {
      const device = await Notifications.getDevicePushTokenAsync();
      const token = typeof device.data === 'string' ? device.data.trim() : '';
      if (!token) return null;
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      return {
        token,
        platform,
        provider: platform === 'ios' ? 'apns' : 'fcm',
      };
    } catch {
      return null;
    }
  },
};
