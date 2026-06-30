import {
  DEFAULT_SDK_LOG_LEVEL,
  type SdkLogLevel,
} from '@getrheo/contracts/sdk';

export type SdkLogger = {
  warn: (msg: string, meta?: unknown) => void;
  debug: (msg: string, meta?: unknown) => void;
};

const silentLogger: SdkLogger = {
  warn: () => {},
  debug: () => {},
};

const warnsAtLevel = (level: SdkLogLevel): boolean => level === 'warn' || level === 'debug';

export const createSdkLogger = (level: SdkLogLevel): SdkLogger => {
  if (level === 'silent') return silentLogger;
  return {
    warn: (msg, meta) => {
      if (!warnsAtLevel(level)) return;
      if (meta === undefined) console.warn(msg);
      else console.warn(msg, meta);
    },
    debug: (msg, meta) => {
      if (level !== 'debug') return;
      if (meta === undefined) console.log(msg);
      else console.log(msg, meta);
    },
  };
};

export const isSdkDevDiagnosticsEnabled = (level: SdkLogLevel): boolean =>
  level === 'debug' && typeof __DEV__ !== 'undefined' && __DEV__;

let activeLogLevel: SdkLogLevel = DEFAULT_SDK_LOG_LEVEL;
let activeLogger: SdkLogger = silentLogger;

export const registerSdkLogLevel = (level: SdkLogLevel): void => {
  activeLogLevel = level;
  activeLogger = createSdkLogger(level);
};

export const getSdkLogLevel = (): SdkLogLevel => activeLogLevel;

export const getSdkLogger = (): SdkLogger => activeLogger;
