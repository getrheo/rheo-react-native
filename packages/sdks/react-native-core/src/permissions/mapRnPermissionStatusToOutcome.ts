import type { PermissionOutcome } from '@getrheo/contracts';

/** Maps react-native-permissions RESULTS string values to flow branch outcomes. */
export const mapRnPermissionStatusToOutcome = (status: string): PermissionOutcome => {
  switch (status) {
    case 'granted':
    case 'limited':
      return 'granted';
    case 'blocked':
      return 'blocked';
    case 'unavailable':
      return 'blocked';
    case 'denied':
    default:
      return 'denied';
  }
};
