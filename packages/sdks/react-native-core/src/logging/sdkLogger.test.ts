import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSdkLogger,
  getSdkLogLevel,
  isSdkDevDiagnosticsEnabled,
  registerSdkLogLevel,
} from './sdkLogger';

describe('createSdkLogger', () => {
  it('silent logger emits nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createSdkLogger('silent');
    logger.warn('[rheo] test');
    logger.debug('[rheo] test');
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    warn.mockRestore();
    log.mockRestore();
  });

  it('warn logger emits warnings only', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createSdkLogger('warn');
    logger.warn('[rheo] transport');
    logger.debug('[rheo] manifest');
    expect(warn).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
    warn.mockRestore();
    log.mockRestore();
  });

  it('debug logger emits warnings and debug messages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createSdkLogger('debug');
    logger.warn('[rheo] transport');
    logger.debug('[rheo] manifest');
    expect(warn).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
    warn.mockRestore();
    log.mockRestore();
  });
});

describe('isSdkDevDiagnosticsEnabled', () => {
  afterEach(() => {
    registerSdkLogLevel('silent');
  });

  it('requires debug level and __DEV__', () => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      expect(isSdkDevDiagnosticsEnabled('debug')).toBe(true);
      expect(isSdkDevDiagnosticsEnabled('warn')).toBe(false);
      expect(isSdkDevDiagnosticsEnabled('silent')).toBe(false);
    } else {
      expect(isSdkDevDiagnosticsEnabled('debug')).toBe(false);
    }
  });
});

describe('registerSdkLogLevel', () => {
  afterEach(() => {
    registerSdkLogLevel('silent');
  });

  it('updates active log level', () => {
    registerSdkLogLevel('warn');
    expect(getSdkLogLevel()).toBe('warn');
  });
});
