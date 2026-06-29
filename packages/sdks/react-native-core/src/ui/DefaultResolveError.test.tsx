import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RESOLVE_ERROR_RETRY_LABEL,
  DEFAULT_RESOLVE_ERROR_TITLE,
  DefaultResolveError,
} from './DefaultResolveError.js';

type ReactTestRenderer = { unmount: () => void; toJSON: () => unknown };
type RtrModule = {
  create: (el: unknown) => ReactTestRenderer;
  act: (cb: () => Promise<void> | void) => Promise<void>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer') as RtrModule;
const { act } = TestRenderer;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DefaultResolveError', () => {
  it('renders generic copy and retry label', async () => {
    const onRetry = vi.fn();
    const tree = TestRenderer.create(
      createElement(DefaultResolveError, { theme: 'light', onRetry }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const serialized = JSON.stringify(tree.toJSON());
    expect(serialized).toContain(DEFAULT_RESOLVE_ERROR_TITLE);
    expect(serialized).toContain(DEFAULT_RESOLVE_ERROR_RETRY_LABEL);
    tree.unmount();
  });
});
