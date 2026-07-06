/** Inlined for public mirror — @rheo/platform-contracts stays private. */
export type FlowTemplateId =
  | 'stories'
  | 'language_learning'
  | 'fitness'
  | 'win_back'
  | 'feedback'
  | 'word_learning'
  | 'journal_onboarding';

/** Display names for seeded template flows — titles match `FLOW_TEMPLATE_CATALOG`. */
export const SEED_TEMPLATE_FLOW_NAMES: Record<FlowTemplateId, string> = {
  stories: 'Seed · Animation stress harness',
  language_learning: 'Seed · Language learning',
  fitness: 'Seed · Layer stress harness',
  win_back: 'Seed · Win-back',
  feedback: 'Seed · Feedback',
  word_learning: 'Seed · Word learning',
  journal_onboarding: 'Seed · Journal onboarding',
};

export const seedFlowNameForTemplate = (templateId: FlowTemplateId): string =>
  SEED_TEMPLATE_FLOW_NAMES[templateId];

/** Primary onboarding flow for default channels, experiments, and E2E. */
export const SEED_WELCOME_FLOW_NAME = SEED_TEMPLATE_FLOW_NAMES.language_learning;
export const SEED_STRESS_HARNESS_FLOW_NAME = SEED_TEMPLATE_FLOW_NAMES.fitness;
export const SEED_ANIMATION_LAB_FLOW_NAME = SEED_TEMPLATE_FLOW_NAMES.stories;
export const SEED_AUTH_CANVAS_FLOW_NAME = SEED_TEMPLATE_FLOW_NAMES.journal_onboarding;
export const SEED_PAYWALL_FLOW_NAME = SEED_TEMPLATE_FLOW_NAMES.win_back;
