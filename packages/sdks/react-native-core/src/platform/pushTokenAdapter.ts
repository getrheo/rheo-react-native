export type PushDeviceToken = {
  token: string;
  platform: 'ios' | 'android';
  provider: 'apns' | 'fcm';
};

export type PushTokenAdapter = {
  getDevicePushToken: () => Promise<PushDeviceToken | null>;
};

let adapter: PushTokenAdapter | null = null;

export const registerPushTokenAdapter = (next: PushTokenAdapter): void => {
  adapter = next;
};

export const getPushTokenAdapter = (): PushTokenAdapter | null => adapter;

/** Vitest and internal tests may inject an adapter without a flavor package. */
export const __resetPushTokenAdapterForTests = (): void => {
  adapter = null;
};

export const __setPushTokenAdapterForTests = (next: PushTokenAdapter | null): void => {
  adapter = next;
};
