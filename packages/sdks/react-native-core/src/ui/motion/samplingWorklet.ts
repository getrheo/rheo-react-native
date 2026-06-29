import { EASING_BEZIERS } from '@getrheo/flow-runtime';
import type { AnimatableProperty, AnimationClip } from '@getrheo/contracts';
import type { Screen } from '@getrheo/contracts';

export type SampledClipWorklet = Partial<Record<AnimatableProperty, number>>;

/** Primitive-only clip payload safe to capture in Reanimated worklets. */
export type WorkletKeyframe = {
  t: number;
  value: number;
  easing?: keyof typeof EASING_BEZIERS;
};

export type WorkletTrack = {
  property: AnimatableProperty;
  keyframes: WorkletKeyframe[];
};

export type WorkletAnimationClip = {
  id: string;
  trigger: string;
  durationMs: number;
  delayMs: number;
  staggerIndex: number;
  tracks: WorkletTrack[];
};

/** Flatten manifest clips for UI-thread sampling (no Maps, no optional nesting). */
export const animationClipsToWorkletPayload = (
  clips: AnimationClip[],
): WorkletAnimationClip[] =>
  clips.map((clip) => ({
    id: clip.id,
    trigger: clip.trigger,
    durationMs: clip.durationMs,
    delayMs: clip.delayMs ?? 0,
    staggerIndex: clip.staggerIndex ?? 0,
    tracks: clip.tracks.map((track) => ({
      property: track.property,
      keyframes: track.keyframes.map((kf) => ({
        t: kf.t,
        value: kf.value,
        ...(kf.easing ? { easing: kf.easing } : {}),
      })),
    })),
  }));

const sampleBezierWorklet = (
  t: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => {
  'worklet';
  if (x1 === y1 && x2 === y2) return t;
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const xAt = (s: number) => ((ax * s + bx) * s + cx) * s;
  const yAt = (s: number) => ((ay * s + by) * s + cy) * s;
  const dxAt = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  let s = t;
  for (let i = 0; i < 8; i++) {
    const x = xAt(s) - t;
    const dx = dxAt(s);
    if (Math.abs(x) < 1e-6) return yAt(s);
    if (Math.abs(dx) < 1e-6) break;
    s -= x / dx;
  }
  let lo = 0;
  let hi = 1;
  s = t;
  for (let i = 0; i < 24; i++) {
    const x = xAt(s);
    if (Math.abs(x - t) < 1e-6) return yAt(s);
    if (x < t) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return yAt(s);
};

const sampleTrackWorklet = (keyframes: WorkletKeyframe[], tNorm: number): number => {
  'worklet';
  if (tNorm <= keyframes[0]!.t) return keyframes[0]!.value;
  if (tNorm >= keyframes[keyframes.length - 1]!.t) return keyframes[keyframes.length - 1]!.value;
  let prev: WorkletKeyframe = keyframes[0]!;
  let next: WorkletKeyframe = keyframes[keyframes.length - 1]!;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i]!.t <= tNorm && keyframes[i + 1]!.t >= tNorm) {
      prev = keyframes[i]!;
      next = keyframes[i + 1]!;
      break;
    }
  }
  const span = next.t - prev.t;
  const localT = span === 0 ? 0 : (tNorm - prev.t) / span;
  const token = prev.easing ?? 'linear';
  const [bx1, by1, bx2, by2] = EASING_BEZIERS[token];
  const eased = sampleBezierWorklet(localT, bx1, by1, bx2, by2);
  return prev.value + (next.value - prev.value) * eased;
};

const effectiveDelayMsWorklet = (
  clip: WorkletAnimationClip,
  staggerStepMs: number,
): number => {
  'worklet';
  if (clip.trigger === 'stagger') {
    return clip.delayMs + clip.staggerIndex * staggerStepMs;
  }
  return clip.delayMs;
};

const sampleClipAtWorklet = (
  clip: WorkletAnimationClip,
  staggerStepMs: number,
  tMs: number,
): SampledClipWorklet => {
  'worklet';
  const delay = effectiveDelayMsWorklet(clip, staggerStepMs);
  const local = clip.durationMs > 0 ? (tMs - delay) / clip.durationMs : 1;
  const tNorm = Math.min(1, Math.max(0, local));
  const out: SampledClipWorklet = {};
  for (let i = 0; i < clip.tracks.length; i++) {
    const track = clip.tracks[i]!;
    out[track.property] = sampleTrackWorklet(track.keyframes, tNorm);
  }
  return out;
};

const mergeSampledClipsWorklet = (
  base: SampledClipWorklet,
  overlay: SampledClipWorklet,
): SampledClipWorklet => {
  'worklet';
  const out: SampledClipWorklet = { ...base };
  if (overlay.opacity !== undefined) out.opacity = overlay.opacity;
  if (overlay.translateX !== undefined) out.translateX = overlay.translateX;
  if (overlay.translateY !== undefined) out.translateY = overlay.translateY;
  if (overlay.scale !== undefined) out.scale = overlay.scale;
  return out;
};

/** Worklet-safe parity with {@link sampleLayerAnimAt} for a pre-sorted clip list. */
export const sampleLayerClipsAtWorklet = (
  clips: WorkletAnimationClip[],
  staggerStepMs: number,
  tMs: number,
): SampledClipWorklet => {
  'worklet';
  if (clips.length === 0) return {};

  let state: SampledClipWorklet = {};
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    const d = effectiveDelayMsWorklet(clip, staggerStepMs);
    const end = d + clip.durationMs;
    if (tMs < d) {
      if (clip.trigger === 'unmount') continue;
      if (clip.trigger !== 'mount' && clip.trigger !== 'stagger') continue;
      let earlierAnimating = false;
      for (let j = 0; j < i; j++) {
        const earlier = clips[j]!;
        const dE = effectiveDelayMsWorklet(earlier, staggerStepMs);
        const endE = dE + earlier.durationMs;
        if (tMs >= dE && tMs < endE) {
          earlierAnimating = true;
          break;
        }
      }
      if (earlierAnimating) continue;
      const pending = sampleClipAtWorklet(clip, staggerStepMs, d);
      state = mergeSampledClipsWorklet(state, pending);
      continue;
    }
    const at = tMs <= end ? tMs : end;
    state = mergeSampledClipsWorklet(state, sampleClipAtWorklet(clip, staggerStepMs, at));
  }
  return state;
};

export const layerHasClipsWorklet = (clips: WorkletAnimationClip[] | undefined): boolean => {
  'worklet';
  return (clips?.length ?? 0) > 0;
};

export const staggerStepMsFromScreen = (screen: Screen): number => screen.stagger?.stepMs ?? 60;
