import { describe, expect, it } from 'vitest';
import { mapRnPermissionStatusToOutcome } from './mapRnPermissionStatusToOutcome';

describe('mapRnPermissionStatusToOutcome', () => {
  it('maps granted and limited to granted', () => {
    expect(mapRnPermissionStatusToOutcome('granted')).toBe('granted');
    expect(mapRnPermissionStatusToOutcome('limited')).toBe('granted');
  });

  it('maps blocked and unavailable to blocked', () => {
    expect(mapRnPermissionStatusToOutcome('blocked')).toBe('blocked');
    expect(mapRnPermissionStatusToOutcome('unavailable')).toBe('blocked');
  });

  it('maps denied and unknown to denied', () => {
    expect(mapRnPermissionStatusToOutcome('denied')).toBe('denied');
    expect(mapRnPermissionStatusToOutcome('')).toBe('denied');
  });
});
