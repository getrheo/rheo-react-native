import { describe, expect, it, vi } from 'vitest';

vi.mock('./ui', () => ({
  LayerRenderer: () => null,
  Flow: () => null,
}));

import {
  initFlowState,
  startFlow,
  submitResponse,
  buildCompletionResponses,
} from './index';
import type { FlowManifest } from '@getrheo/contracts';

const manifest: FlowManifest = {
  flowId: '00000000-0000-0000-0000-000000000001',
  schemaVersion: 7,
  version: 1,
  defaultLocale: 'en',
  locales: ['en'],
  entryScreenId: 'scr_cta',
  screens: [
    {
      id: 'scr_cta',
      name: 'CTA',
      regions: {
        body: {
          id: 'lyr_cta_body',
          kind: 'stack',
          direction: 'vertical',
          children: [
            {
              id: 'lyr_cta_title',
              kind: 'text',
              text: { default: 'Hi' },
            },
            {
              id: 'lyr_cta_btn',
              kind: 'button',
              variant: 'primary',
              action: { kind: 'continue' },
              children: [
                { id: 'lyr_cta_btn_text', kind: 'text', text: { default: 'Go' } },
              ],
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

describe('SDK runtime re-exports', () => {
  it('runs a flow to completion', () => {
    const s0 = startFlow(initFlowState(manifest));
    const s1 = submitResponse(s0, { kind: 'cta', action: 'primary' });
    expect(s1.status).toBe('completed');
    expect(buildCompletionResponses(s1)).toBeDefined();
  });
});
