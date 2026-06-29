import type { AnimationClip } from '@getrheo/contracts/animations';
import { DEFAULT_THEMED_FOREGROUND, PRIMARY_FILLED_LABEL } from '@getrheo/contracts/layers';
import { FlowManifestSchema, MANIFEST_SCHEMA_VERSION, type FlowManifest } from '@getrheo/contracts/manifest';
import type { Screen } from '@getrheo/contracts/screens';

const mountOpacity = (
  id: string,
  layerId: string,
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'standard' | 'emphasized',
  delayMs?: number,
): AnimationClip => ({
  id,
  targetLayerId: layerId,
  trigger: 'mount',
  durationMs: 360,
  ...(delayMs !== undefined ? { delayMs } : {}),
  tracks: [
    {
      property: 'opacity',
      keyframes: [
        { t: 0, value: 0, easing },
        { t: 1, value: 1 },
      ],
    },
  ],
});

const staggerFadeSlide = (
  id: string,
  layerId: string,
  idx: number,
): AnimationClip => ({
  id,
  targetLayerId: layerId,
  trigger: 'stagger',
  staggerIndex: idx,
  durationMs: 320,
  tracks: [
    {
      property: 'opacity',
      keyframes: [
        { t: 0, value: 0, easing: 'emphasized' },
        { t: 1, value: 1 },
      ],
    },
    {
      property: 'translateY',
      keyframes: [
        { t: 0, value: 18, easing: 'emphasized' },
        { t: 1, value: 0 },
      ],
    },
  ],
});

const unmountFade = (id: string, layerId: string): AnimationClip => ({
  id,
  targetLayerId: layerId,
  trigger: 'unmount',
  durationMs: 280,
  tracks: [
    {
      property: 'opacity',
      keyframes: [
        { t: 0, value: 1, easing: 'ease-in' },
        { t: 1, value: 0 },
      ],
    },
  ],
});

const bodyStack = (id: string, children: Screen['regions']['body']['children']): Screen['regions']['body'] => ({
  id,
  kind: 'stack',
  direction: 'vertical',
  gap: 12,
  style: { padding: { t: 16, r: 16, b: 16, l: 16 } },
  children,
});

const continueBtn = (id: string): NonNullable<Screen['regions']['body']['children'][number]> => ({
  id,
  kind: 'button',
  variant: 'primary',
  action: { kind: 'continue' },
  direction: 'horizontal',
  align: 'center',
  distribution: 'center',
  children: [
    { id: `${id}_t`, kind: 'text', text: { default: 'Next' }, style: { color: PRIMARY_FILLED_LABEL } },
  ],
});

/**
 * Linear gallery: mount/stagger/unmount clips, all easings, multi-track layers.
 */
export const buildAnimationLabManifest = (flowId: string): FlowManifest =>
  FlowManifestSchema.parse({
    flowId,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    version: 1,
    defaultLocale: 'en',
    locales: ['en'],
    entryScreenId: 'scr_al_0',
    theme: {
      primary: '#4f46e5',
      background: '#fafafa',
      foreground: '#0a0a0a',
      borderRadius: 12,
    },
    builderMeta: {
      layout: {
        nodes: Array.from({ length: 11 }, (_, i) => ({
          id: `scr_al_${i}`,
          kind: 'screen' as const,
          x: 40 + (i % 4) * 220,
          y: 40 + Math.floor(i / 4) * 140,
        })),
        canvas: { zoom: 0.85, x: 0, y: 0 },
      },
    },
    sdkAttributeKeys: [],
    screens: [
      {
        id: 'scr_al_0',
        name: 'AL · Entry (transition none)',
        transition: { kind: 'none' },
        regions: {
          body: bodyStack('lyr_al0_b', [
            { id: 'lyr_al0_t', kind: 'text', text: { default: 'Animation lab — entry' }, style: { fontSize: 20, fontWeight: 700, color: DEFAULT_THEMED_FOREGROUND } },
            continueBtn('lyr_al0_go'),
          ]),
        },
        animations: [mountOpacity('c_al0', 'lyr_al0_t', 'standard')],
        next: { default: 'scr_al_1' },
      },
      {
        id: 'scr_al_1',
        name: 'AL · Slide left (linear)',
        transition: { kind: 'slide-left', durationMs: 280, easing: 'linear' },
        regions: {
          body: bodyStack('lyr_al1_b', [
            { id: 'lyr_al1_t', kind: 'text', text: { default: 'Outgoing transition: slide left' }, style: { color: DEFAULT_THEMED_FOREGROUND } },
            continueBtn('lyr_al1_go'),
          ]),
        },
        animations: [
          mountOpacity('c_al1a', 'lyr_al1_t', 'ease-in'),
          {
            id: 'c_al1b',
            targetLayerId: 'lyr_al1_go',
            trigger: 'mount',
            durationMs: 400,
            delayMs: 60,
            tracks: [
              {
                property: 'scale',
                keyframes: [
                  { t: 0, value: 0.92, easing: 'ease-out' },
                  { t: 1, value: 1 },
                ],
              },
            ],
          },
        ],
        next: { default: 'scr_al_2' },
      },
      {
        id: 'scr_al_2',
        name: 'AL · Slide left',
        transition: { kind: 'slide-left', durationMs: 320, easing: 'emphasized' },
        regions: {
          body: bodyStack('lyr_al2_b', [
            { id: 'lyr_al2_t', kind: 'text', text: { default: 'Slide left' }, style: { color: DEFAULT_THEMED_FOREGROUND } },
            continueBtn('lyr_al2_go'),
          ]),
        },
        animations: [
          {
            id: 'c_al2',
            targetLayerId: 'lyr_al2_t',
            trigger: 'mount',
            durationMs: 420,
            tracks: [
              {
                property: 'translateX',
                keyframes: [
                  { t: 0, value: -24, easing: 'standard' },
                  { t: 1, value: 0 },
                ],
              },
              {
                property: 'opacity',
                keyframes: [
                  { t: 0, value: 0 },
                  { t: 1, value: 1 },
                ],
              },
            ],
          },
        ],
        next: { default: 'scr_al_3' },
      },
      {
        id: 'scr_al_3',
        name: 'AL · Slide right',
        transition: { kind: 'slide-right', durationMs: 300, easing: 'ease-in-out' },
        regions: {
          body: bodyStack('lyr_al3_b', [
            { id: 'lyr_al3_t', kind: 'text', text: { default: 'Slide right' }, style: { color: DEFAULT_THEMED_FOREGROUND } },
            continueBtn('lyr_al3_go'),
          ]),
        },
        animations: [mountOpacity('c_al3', 'lyr_al3_t', 'ease-out')],
        next: { default: 'scr_al_4' },
      },
      {
        id: 'scr_al_4',
        name: 'AL · Slide up',
        transition: { kind: 'slide-up', durationMs: 300, easing: 'ease-out' },
        regions: {
          body: bodyStack('lyr_al4_b', [
            { id: 'lyr_al4_t', kind: 'text', text: { default: 'Slide up' }, style: { color: DEFAULT_THEMED_FOREGROUND } },
            continueBtn('lyr_al4_go'),
          ]),
        },
        animations: [mountOpacity('c_al4', 'lyr_al4_go', 'linear', 40)],
        next: { default: 'scr_al_5' },
      },
      {
        id: 'scr_al_5',
        name: 'AL · Stagger (slide left)',
        transition: { kind: 'slide-left', durationMs: 280, easing: 'standard' },
        regions: {
          body: bodyStack('lyr_al5_b', [
            { id: 'lyr_al5_t', kind: 'text', text: { default: 'Stagger + outgoing slide left' }, style: { color: DEFAULT_THEMED_FOREGROUND } },
            continueBtn('lyr_al5_go'),
          ]),
        },
        stagger: { stepMs: 72 },
        animations: [staggerFadeSlide('c_al5a', 'lyr_al5_t', 0), staggerFadeSlide('c_al5b', 'lyr_al5_go', 1)],
        next: { default: 'scr_al_6' },
      },
      {
        id: 'scr_al_6',
        name: 'AL · Stagger grid',
        transition: { kind: 'slide-right', durationMs: 200, easing: 'linear' },
        regions: {
          body: bodyStack('lyr_al6_b', [
            {
              id: 'lyr_al6_row',
              kind: 'stack',
              direction: 'horizontal',
              gap: 8,
              wrap: true,
              children: ['Ease demos', 'linear', 'ease-in', 'ease-out', 'in-out', 'std', 'emph'].map((label, i) => ({
                id: `lyr_al6_e${i}`,
                kind: 'text' as const,
                text: { default: label },
                style: { fontSize: 12, color: DEFAULT_THEMED_FOREGROUND },
              })),
            },
            continueBtn('lyr_al6_go'),
          ]),
        },
        stagger: { stepMs: 55 },
        animations: [
          staggerFadeSlide('c_al6_0', 'lyr_al6_e0', 0),
          staggerFadeSlide('c_al6_1', 'lyr_al6_e1', 1),
          staggerFadeSlide('c_al6_2', 'lyr_al6_e2', 2),
          staggerFadeSlide('c_al6_3', 'lyr_al6_e3', 3),
          staggerFadeSlide('c_al6_4', 'lyr_al6_e4', 4),
          staggerFadeSlide('c_al6_5', 'lyr_al6_e5', 5),
          staggerFadeSlide('c_al6_6', 'lyr_al6_go', 6),
        ],
        next: { default: 'scr_al_7' },
      },
      {
        id: 'scr_al_7',
        name: 'AL · Translate axes + unmount',
        transition: { kind: 'slide-up', durationMs: 250, easing: 'ease-in-out' },
        regions: {
          body: bodyStack('lyr_al7_b', [
            {
              id: 'lyr_al7_t1',
              kind: 'text',
              text: { default: 'TranslateX mount' },
              style: { color: DEFAULT_THEMED_FOREGROUND },
            },
            {
              id: 'lyr_al7_t2',
              kind: 'text',
              text: { default: 'TranslateY mount' },
              style: { color: DEFAULT_THEMED_FOREGROUND },
            },
            continueBtn('lyr_al7_go'),
          ]),
        },
        animations: [
          {
            id: 'c_al7x',
            targetLayerId: 'lyr_al7_t1',
            trigger: 'mount',
            durationMs: 400,
            tracks: [
              {
                property: 'translateX',
                keyframes: [
                  { t: 0, value: 40, easing: 'standard' },
                  { t: 1, value: 0 },
                ],
              },
            ],
          },
          {
            id: 'c_al7y',
            targetLayerId: 'lyr_al7_t2',
            trigger: 'mount',
            durationMs: 400,
            tracks: [
              {
                property: 'translateY',
                keyframes: [
                  { t: 0, value: -20, easing: 'emphasized' },
                  { t: 1, value: 0 },
                ],
              },
            ],
          },
          unmountFade('c_al7_u1', 'lyr_al7_t1'),
          unmountFade('c_al7_u2', 'lyr_al7_t2'),
        ],
        next: { default: 'scr_al_8' },
      },
      {
        id: 'scr_al_8',
        name: 'AL · Dual clips one layer',
        transition: { kind: 'slide-left', durationMs: 260 },
        regions: {
          body: bodyStack('lyr_al8_b', [
            { id: 'lyr_al8_hero', kind: 'text', text: { default: 'Mount + unmount on same layer' }, style: { fontSize: 18, fontWeight: 600, color: DEFAULT_THEMED_FOREGROUND } },
            continueBtn('lyr_al8_go'),
          ]),
        },
        animations: [
          {
            id: 'c_al8_m',
            targetLayerId: 'lyr_al8_hero',
            trigger: 'mount',
            durationMs: 500,
            tracks: [
              {
                property: 'opacity',
                keyframes: [
                  { t: 0, value: 0 },
                  { t: 1, value: 1 },
                ],
              },
              {
                property: 'scale',
                keyframes: [
                  { t: 0, value: 0.85, easing: 'ease-in-out' },
                  { t: 1, value: 1 },
                ],
              },
            ],
          },
          {
            id: 'c_al8_u',
            targetLayerId: 'lyr_al8_hero',
            trigger: 'unmount',
            durationMs: 340,
            tracks: [
              {
                property: 'opacity',
                keyframes: [
                  { t: 0, value: 1 },
                  { t: 1, value: 0 },
                ],
              },
              {
                property: 'translateX',
                keyframes: [
                  { t: 0, value: 0, easing: 'ease-in' },
                  { t: 1, value: -12 },
                ],
              },
            ],
          },
        ],
        next: { default: 'scr_al_9' },
      },
      {
        id: 'scr_al_9',
        name: 'AL · Easing tokens',
        transition: { kind: 'none' },
        regions: {
          body: bodyStack('lyr_al9_b', [
            ...(
              [
                ['linear', 'lyr_al9_l', 'linear'] as const,
                ['ease-in', 'lyr_al9_i', 'ease-in'] as const,
                ['ease-out', 'lyr_al9_o', 'ease-out'] as const,
                ['ease-in-out', 'lyr_al9_io', 'ease-in-out'] as const,
                ['standard', 'lyr_al9_s', 'standard'] as const,
                ['emphasized', 'lyr_al9_e', 'emphasized'] as const,
              ] as const
            ).map(([label, lid]) => ({
              id: lid,
              kind: 'text' as const,
              text: { default: label },
              style: { color: DEFAULT_THEMED_FOREGROUND },
            })),
            continueBtn('lyr_al9_go'),
          ]),
        },
        animations: [
          mountOpacity('ca9_l', 'lyr_al9_l', 'linear'),
          mountOpacity('ca9_i', 'lyr_al9_i', 'ease-in'),
          mountOpacity('ca9_o', 'lyr_al9_o', 'ease-out'),
          mountOpacity('ca9_io', 'lyr_al9_io', 'ease-in-out'),
          mountOpacity('ca9_s', 'lyr_al9_s', 'standard'),
          mountOpacity('ca9_e', 'lyr_al9_e', 'emphasized'),
          mountOpacity('ca9_go', 'lyr_al9_go', 'standard', 24),
        ],
        next: { default: 'scr_al_10' },
      },
      {
        id: 'scr_al_10',
        name: 'AL · Done',
        transition: { kind: 'none' },
        containerStyle: {
          padding: { t: 8 },
          backgroundFill: { kind: 'color', color: { light: '#f4f4f5', dark: '#18181b' } },
        },
        regions: {
          body: bodyStack('lyr_al10_b', [
            { id: 'lyr_al10_t', kind: 'text', text: { default: 'Animation lab complete' }, style: { fontSize: 20, fontWeight: 700, color: DEFAULT_THEMED_FOREGROUND } },
            {
              id: 'lyr_al10_end',
              kind: 'button',
              variant: 'secondary',
              action: { kind: 'end_flow' },
              direction: 'horizontal',
              children: [
                { id: 'lyr_al10_et', kind: 'text', text: { default: 'End flow' }, style: { color: DEFAULT_THEMED_FOREGROUND } },
              ],
            },
          ]),
        },
        animations: [mountOpacity('ca10', 'lyr_al10_t', 'emphasized')],
        next: { default: null },
      },
    ],
    decisionNodes: [],
  });
