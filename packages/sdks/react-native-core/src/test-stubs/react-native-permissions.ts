/**
 * Vitest-only stub. Production apps resolve the real package from node_modules via Metro / bundler.
 * @see vitest.config.ts resolve.alias
 */

const IOS = {
  CAMERA: 'ios.permission.CAMERA',
  MICROPHONE: 'ios.permission.MICROPHONE',
  PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
  CONTACTS: 'ios.permission.CONTACTS',
  CALENDARS: 'ios.permission.CALENDARS',
} as const;

const ANDROID = {
  CAMERA: 'android.permission.CAMERA',
  RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
  READ_MEDIA_IMAGES: 'android.permission.READ_MEDIA_IMAGES',
  READ_CONTACTS: 'android.permission.READ_CONTACTS',
  READ_CALENDAR: 'android.permission.READ_CALENDAR',
} as const;

export const PERMISSIONS = {
  IOS,
  ANDROID,
} as const;

export const request = async (_permission: string): Promise<string> => 'denied';

export const requestNotifications = async (): Promise<{ status: string; settings: object }> => ({
  status: 'denied',
  settings: {},
});

export const checkNotifications = async (): Promise<{ status: string; settings: object }> => ({
  status: 'denied',
  settings: {},
});
