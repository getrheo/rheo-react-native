import { describe, expect, it, vi } from 'vitest';
import type { SdkResolveResponse } from '@getrheo/contracts';
import type { Screen } from '@getrheo/contracts/screens';
import { enqueueInputCaptureAnalytics } from './inputCaptureAnalytics.js';

const resolveData = (): SdkResolveResponse =>
  ({
    flowId: 'flow_1',
    versionId: 'ver_1',
    experimentId: null,
    variantId: null,
    manifest: { screens: [] },
  }) as unknown as SdkResolveResponse;

const choiceScreen = (): Screen =>
  ({
    id: 'scr_1',
    name: 'Choice',
    regions: {
      body: {
        id: 'lyr_choice',
        kind: 'single_choice',
        fieldKey: 'goal',
        children: [],
        optionBindings: [],
        branching: { enabled: false, conditions: [] },
      },
    },
  }) as unknown as Screen;

describe('enqueueInputCaptureAnalytics', () => {
  it('emits choice_selected before step_completed would run', () => {
    const calls: string[] = [];
    const enqueueSdk = vi.fn((input: { name: string }) => {
      calls.push(input.name);
    });
    enqueueInputCaptureAnalytics(
      enqueueSdk,
      resolveData(),
      'scr_1',
      choiceScreen(),
      { kind: 'choice', choiceId: 'opt_a' },
    );
    expect(calls).toEqual(['choice_selected']);
  });

  it('emits text_submitted for scale input', () => {
    const enqueueSdk = vi.fn();
    const screen = {
      id: 'scr_2',
      name: 'Scale',
      regions: {
        body: {
          id: 'lyr_scale',
          kind: 'scale_input',
          fieldKey: 'rating',
          min: 1,
          max: 5,
        },
      },
    } as unknown as Screen;
    enqueueInputCaptureAnalytics(
      enqueueSdk,
      resolveData(),
      'scr_2',
      screen,
      { kind: 'scale', value: 4 },
    );
    expect(enqueueSdk).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'text_submitted',
        properties: { field_key: 'rating', value: '4' },
      }),
    );
  });
});
