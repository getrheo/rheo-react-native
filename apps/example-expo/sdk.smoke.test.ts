import { describe, expect, it } from 'vitest';

describe('@rheo/example-expo workspace smoke', () => {
  it('runs vitest in this workspace', () => {
    expect(1 + 1).toBe(2);
  });
});
