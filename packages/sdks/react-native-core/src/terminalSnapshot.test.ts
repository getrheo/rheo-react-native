import { describe, expect, it } from 'vitest';
import type { FlowManifest, SdkResolveResponse } from '@getrheo/contracts';
import type {FlowState} from '@getrheo/flow-runtime';
import { initFlowState } from '@getrheo/flow-runtime';
import { buildTerminalSnapshot } from './terminalSnapshot';

const baseResolve = (manifest: FlowManifest): SdkResolveResponse => ({
  flowId: manifest.flowId,
  versionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  versionNumber: 1,
  assignmentVersion: 0,
  environment: 'test',
  channelId: 'ch_terminal_snap',
  experimentId: null,
  variantId: null,
  manifest,
  mediaMap: {},
  features: { attribution: false },
  integrations: {
    revenuecat: { enabled: false, defaultOfferingId: '', defaultPlacementId: '' },
    appsflyer: { enabled: false },
  },
});

const snapshotInput = (
  terminal: 'completed' | 'abandoned',
  state: FlowState,
  resolved: SdkResolveResponse,
) =>
  buildTerminalSnapshot({
    terminal,
    resolved,
    state,
    subject: { appUserId: 'u1' },
    includeManifest: false,
    includePath: false,
    includeAnswerDetail: false,
  });

describe('buildTerminalSnapshot answers', () => {
  it('adds null for visited screen capture keys missing from responses', () => {
    const manifest: FlowManifest = {
      flowId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      schemaVersion: 7,
      version: 1,
      defaultLocale: 'en',
      locales: ['en'],
      entryScreenId: 'scr_input',
      screens: [
        {
          id: 'scr_input',
          name: 'Input',
          regions: {
            body: {
              id: 'lyr_stack',
              kind: 'stack',
              direction: 'vertical',
              children: [
                {
                  id: 'lyr_cb',
                  kind: 'checkbox',
                  fieldKey: 'terms',
                },
                {
                  id: 'lyr_ti',
                  kind: 'text_input',
                  fieldKey: 'field_alpha',
                  classification: 'safe',
                },
              ],
            },
          },
          next: { default: null },
        },
      ],
      decisionNodes: [],
      externalSurfaceNodes: [],
      sdkAttributeKeys: [],
    };
    const resolved = baseResolve(manifest);
    const state: FlowState = {
      ...initFlowState(manifest),
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      history: ['scr_input'],
      currentScreenId: null,
      responses: {},
    };
    const snap = snapshotInput('completed', state, resolved);
    expect(snap.answers.field_alpha).toBeNull();
    expect(snap.answers.terms).toBeNull();
  });

  it('keeps completion values when responses exist for capture keys', () => {
    const manifest: FlowManifest = {
      flowId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      schemaVersion: 7,
      version: 1,
      defaultLocale: 'en',
      locales: ['en'],
      entryScreenId: 'scr_input',
      screens: [
        {
          id: 'scr_input',
          name: 'Input',
          regions: {
            body: {
              id: 'lyr_stack',
              kind: 'stack',
              direction: 'vertical',
              children: [
                {
                  id: 'lyr_ti',
                  kind: 'text_input',
                  fieldKey: 'field_alpha',
                  classification: 'safe',
                },
              ],
            },
          },
          next: { default: null },
        },
      ],
      decisionNodes: [],
      externalSurfaceNodes: [],
      sdkAttributeKeys: [],
    };
    const resolved = baseResolve(manifest);
    const state: FlowState = {
      ...initFlowState(manifest),
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      history: ['scr_input'],
      currentScreenId: null,
      responses: {
        field_alpha: { kind: 'text', value: 'Ada', classification: 'safe' },
      },
    };
    const snap = snapshotInput('completed', state, resolved);
    expect(snap.answers.field_alpha).toEqual({ value: 'Ada', classification: 'safe' });
  });

  it('includes currentScreenId when not yet appended to history', () => {
    const manifest: FlowManifest = {
      flowId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      schemaVersion: 7,
      version: 1,
      defaultLocale: 'en',
      locales: ['en'],
      entryScreenId: 'scr_a',
      screens: [
        {
          id: 'scr_a',
          name: 'A',
          regions: {
            body: {
              id: 'lyr_s',
              kind: 'stack',
              direction: 'vertical',
              children: [],
            },
          },
          next: { default: 'scr_b' },
        },
        {
          id: 'scr_b',
          name: 'B',
          regions: {
            body: {
              id: 'lyr_s2',
              kind: 'stack',
              direction: 'vertical',
              children: [
                {
                  id: 'lyr_scale',
                  kind: 'scale_input',
                  fieldKey: 'mood',
                  min: 1,
                  max: 5,
                  step: 1,
                },
              ],
            },
          },
          next: { default: null },
        },
      ],
      decisionNodes: [],
      externalSurfaceNodes: [],
      sdkAttributeKeys: [],
    };
    const resolved = baseResolve(manifest);
    const state: FlowState = {
      ...initFlowState(manifest),
      status: 'abandoned',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      history: ['scr_a'],
      currentScreenId: 'scr_b',
      responses: {},
    };
    const snap = snapshotInput('abandoned', state, resolved);
    expect(snap.answers.mood).toBeNull();
  });
});
