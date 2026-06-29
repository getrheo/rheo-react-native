import { createBuiltInSinglePermissionRunner } from './builtInRnSinglePermissionRequest';

export const executeBuiltInCameraPermission = createBuiltInSinglePermissionRunner((P) => ({
  ios: P.IOS.CAMERA,
  android: P.ANDROID.CAMERA,
}));

export const executeBuiltInMicrophonePermission = createBuiltInSinglePermissionRunner((P) => ({
  ios: P.IOS.MICROPHONE,
  android: P.ANDROID.RECORD_AUDIO,
}));

export const executeBuiltInPhotoLibraryPermission = createBuiltInSinglePermissionRunner((P) => ({
  ios: P.IOS.PHOTO_LIBRARY,
  android: P.ANDROID.READ_MEDIA_IMAGES,
}));

export const executeBuiltInContactsPermission = createBuiltInSinglePermissionRunner((P) => ({
  ios: P.IOS.CONTACTS,
  android: P.ANDROID.READ_CONTACTS,
}));

export const executeBuiltInCalendarPermission = createBuiltInSinglePermissionRunner((P) => ({
  ios: P.IOS.CALENDARS,
  android: P.ANDROID.READ_CALENDAR,
}));
