import type { OsPermissionKey, PermissionOutcome } from '@getrheo/contracts';
import { getSdkLogger, isSdkDevDiagnosticsEnabled, getSdkLogLevel } from '../logging/sdkLogger';
import { executeBuiltInNotificationPermission } from './builtInNotificationPermission';
import {
  executeBuiltInCalendarPermission,
  executeBuiltInCameraPermission,
  executeBuiltInContactsPermission,
  executeBuiltInMicrophonePermission,
  executeBuiltInPhotoLibraryPermission,
} from './builtInStandardOsPermissions';

export type SdkSessionPlatform = 'ios' | 'android' | 'web';

/** Built-in `request_os_permission` handlers keyed by manifest `permissionKey`. */
const builtInHandlers: Partial<Record<OsPermissionKey, () => Promise<PermissionOutcome>>> = {
  notifications: executeBuiltInNotificationPermission,
  camera: executeBuiltInCameraPermission,
  microphone: executeBuiltInMicrophonePermission,
  photo_library: executeBuiltInPhotoLibraryPermission,
  contacts: executeBuiltInContactsPermission,
  calendar: executeBuiltInCalendarPermission,
};

/**
 * Executes the SDK-managed permission prompt when a handler exists.
 * Missing peer libs or web surface → `'denied'`. Unregistered keys → `'denied'`.
 */
export const runBuiltInOsPermissionIfAvailable = async (
  permissionKey: OsPermissionKey,
  sessionPlatform: string,
): Promise<PermissionOutcome> => {
  const platform: SdkSessionPlatform =
    sessionPlatform === 'ios' || sessionPlatform === 'android' || sessionPlatform === 'web'
      ? sessionPlatform
      : 'web';
  if (platform === 'web') {
    if (isSdkDevDiagnosticsEnabled(getSdkLogLevel())) {
      getSdkLogger().debug(
        `[@getrheo/react-native-core] request_os_permission (${permissionKey}) on web has no OS prompt; using denied.`,
      );
    }
    return 'denied';
  }

  const handler = builtInHandlers[permissionKey];
  if (!handler) {
    if (isSdkDevDiagnosticsEnabled(getSdkLogLevel())) {
      getSdkLogger().debug(
        `[@getrheo/react-native-core] No built-in handler for "${permissionKey}"; using denied until SDK adds support.`,
      );
    }
    return 'denied';
  }

  return handler();
};
