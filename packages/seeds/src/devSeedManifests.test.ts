import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { collectCanvasGateViolations, parseCanvasEditorGates } from '@getrheo/contracts/canvasEditorGates';
import type { FlowManifest } from '@getrheo/contracts/manifest';
import { collectFlowBuilderIssues } from '@getrheo/flow-runtime/flowBuilderRules';
import { validateManifest, validatePublishable } from '@getrheo/flow-runtime/validation';
import { buildAnimationLabManifest } from './animationLabManifest';
import { buildAuthCanvasManifest } from './authCanvasManifest';
import { buildPaywallManifest } from './paywallManifest';
import { buildStressHarnessManifest } from './stressHarnessManifest';
import { buildWelcomeLinearManifest } from './welcomeLinearManifest';

const expectSeedManifestHealthy = (m: FlowManifest): void => {
  const parsed = validateManifest(m);
  expect(parsed.ok, parsed.ok ? '' : parsed.issues.map((i) => i.message).join('; ')).toBe(true);
  if (!parsed.ok) return;
  const pub = validatePublishable(parsed.manifest);
  expect(pub.ok, pub.ok ? '' : pub.issues.map((i) => i.message).join('; ')).toBe(true);
  const gates = collectCanvasGateViolations(parsed.manifest, parseCanvasEditorGates(null));
  expect(gates, gates.join('; ')).toEqual([]);
  const builder = collectFlowBuilderIssues(parsed.manifest);
  expect(builder, builder.join('; ')).toEqual([]);
};

describe('dev seed manifests', () => {
  it('parses welcome linear fixture with any flow UUID', () => {
    const id = randomUUID();
    const m = buildWelcomeLinearManifest(id);
    expect(m.flowId).toBe(id);
    expectSeedManifestHealthy(m);
  });

  it('parses stress harness', () => {
    const id = randomUUID();
    const m = buildStressHarnessManifest(id);
    expect(m.entryScreenId).toBe('scr_sh_entry');
    expectSeedManifestHealthy(m);
  });

  it('parses animation lab', () => {
    const id = randomUUID();
    const m = buildAnimationLabManifest(id);
    expect(m.entryScreenId).toBe('scr_al_0');
    expectSeedManifestHealthy(m);
  });

  it('parses auth canvas harness', () => {
    const id = randomUUID();
    const m = buildAuthCanvasManifest(id);
    expect(m.entryScreenId).toBe('scr_auth_intro');
    expectSeedManifestHealthy(m);
  });

  it('parses RevenueCat paywall seed flow', () => {
    const id = randomUUID();
    const m = buildPaywallManifest(id);
    expect(m.externalSurfaceNodes?.[0]?.config).toMatchObject({
      provider: 'revenuecat',
      offeringId: 'default',
    });
    expectSeedManifestHealthy(m);
  });
});
