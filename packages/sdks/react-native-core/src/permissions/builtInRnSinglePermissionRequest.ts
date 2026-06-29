import { Platform } from 'react-native';
import type { PermissionOutcome } from '@getrheo/contracts';
import type { Permission } from 'react-native-permissions';
import { PERMISSIONS, request } from 'react-native-permissions';
import { mapRnPermissionStatusToOutcome } from './mapRnPermissionStatusToOutcome';

type PermissionRoot = typeof PERMISSIONS;

/**
 * Shared `request()` wrapper for `react-native-permissions` keys that map to a
 * single iOS + Android permission constant each.
 */
export const createBuiltInSinglePermissionRunner = (
  pick: (P: PermissionRoot) => { ios: Permission; android: Permission },
): (() => Promise<PermissionOutcome>) => {
  return async () => {
    try {
      const { ios, android } = pick(PERMISSIONS);
      const permission = Platform.OS === 'ios' ? ios : android;
      const status = await request(permission);
      return mapRnPermissionStatusToOutcome(status);
    } catch {
      return 'denied';
    }
  };
};
