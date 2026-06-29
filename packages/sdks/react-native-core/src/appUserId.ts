import { generateEventId } from './events';
import type {RheoConfig} from './client';

/** localStorage key for the default per-browser anonymous id. */
export const PERSISTED_APP_USER_ID_KEY = 'rheo_app_user_id';

let nonBrowserCachedId: string | null = null;

/**
 * When `config.userId` is set, returns it (host owns the primary id).
 * Otherwise returns a stable anonymous id: persisted in `localStorage` on
 * web, or an in-process singleton in non-browser runtimes (tests, SSR
 * without storage — React Native hosts should pass `userId` until a
 * storage adapter exists).
 */
export const getResolvedAppUserId = (config: Pick<RheoConfig, 'userId'>): string => {
  if (config.userId) return config.userId;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(PERSISTED_APP_USER_ID_KEY);
      if (existing) return existing;
      const id = generateEventId();
      window.localStorage.setItem(PERSISTED_APP_USER_ID_KEY, id);
      return id;
    } catch {
      /* private mode / quota — fall through */
    }
  }

  if (!nonBrowserCachedId) nonBrowserCachedId = generateEventId();
  return nonBrowserCachedId;
};

/** Test-only: clears the non-browser singleton so each test file gets a fresh id. */
export const __resetResolvedAppUserIdForTests = (): void => {
  nonBrowserCachedId = null;
};
