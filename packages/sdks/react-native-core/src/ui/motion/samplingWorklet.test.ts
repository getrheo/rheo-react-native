import { describe, expect, it } from 'vitest';
import { sampleLayerAnimAt } from '@getrheo/flow-runtime';
import type { AnimationClip, Screen } from '@getrheo/contracts';
import {
  animationClipsToWorkletPayload,
  sampleLayerClipsAtWorklet,
} from './samplingWorklet';

const screenWith = (animations: AnimationClip[]): Screen => ({
  id: 'scr_test',
  name: 'Test',
  next: { default: null },
  stagger: { stepMs: 50 },
  animations,
  regions: { body: { id: 'lyr_body', kind: 'stack', direction: 'vertical', children: [] } },
});

const fadeIn: AnimationClip = {
  id: 'clip_fade',
  targetLayerId: 'lyr_target',
  trigger: 'mount',
  durationMs: 400,
  tracks: [
    {
      property: 'opacity',
      keyframes: [
        { t: 0, value: 0 },
        { t: 1, value: 1 },
      ],
    },
  ],
};

describe('sampleLayerClipsAtWorklet parity', () => {
  it('animationClipsToWorkletPayload flattens optional clip fields', () => {
    const screen = screenWith([fadeIn]);
    const payload = animationClipsToWorkletPayload(screen.animations ?? []);
    expect(payload[0]).toMatchObject({
      id: 'clip_fade',
      trigger: 'mount',
      durationMs: 400,
      delayMs: 0,
      staggerIndex: 0,
    });
  });

  it('matches sampleLayerAnimAt at several timeline points', () => {
    const screen = screenWith([fadeIn]);
    const clips = animationClipsToWorkletPayload(screen.animations ?? []);
    const staggerStep = 50;
    for (const tMs of [0, 100, 200, 400, 600]) {
      const expected = sampleLayerAnimAt(screen, 'lyr_target', tMs);
      const worklet = sampleLayerClipsAtWorklet(clips, staggerStep, tMs);
      expect(worklet).toEqual(expected);
    }
  });

  it('chains sequential mount clips like flow-runtime', () => {
    const fadeLate: AnimationClip = {
      ...fadeIn,
      id: 'late',
      delayMs: 100,
      durationMs: 200,
    };
    const moveIn: AnimationClip = {
      id: 'move',
      targetLayerId: 'lyr_target',
      trigger: 'mount',
      durationMs: 200,
      tracks: [
        {
          property: 'translateY',
          keyframes: [
            { t: 0, value: 16 },
            { t: 1, value: 0 },
          ],
        },
      ],
    };
    const screen = screenWith([fadeLate, moveIn]);
    const clips = animationClipsToWorkletPayload(screen.animations ?? []);
    expect(sampleLayerClipsAtWorklet(clips, 50, 150)).toEqual(
      sampleLayerAnimAt(screen, 'lyr_target', 150),
    );
  });
});
