import type { PermissionOutcome } from '@getrheo/contracts';
import { requestNotifications } from 'react-native-permissions';
import { mapRnPermissionStatusToOutcome } from './mapRnPermissionStatusToOutcome';

/**
 * Runs the OS notification authorization prompt via `react-native-permissions`
 * (iOS UNUserNotificationCenter + Android POST_NOTIFICATIONS when applicable).
 */
export const executeBuiltInNotificationPermission = async (): Promise<PermissionOutcome> => {
  try {
    const { status } = await requestNotifications(['alert', 'badge', 'sound']);
    return mapRnPermissionStatusToOutcome(status);
  } catch {
    return 'denied';
  }
};
