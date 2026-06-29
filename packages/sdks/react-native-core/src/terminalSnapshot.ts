import type { FlowManifest, FlowTerminalSnapshot, SdkResolveResponse } from '@getrheo/contracts';
import type {FlowState} from '@getrheo/flow-runtime';
import { collectAnswerCaptureFieldKeysFromScreen } from '@getrheo/contracts';
import {
  findScreen,
  stripAuthResponsesForTerminalExport,
  stepResponseToCompletionValue,
} from '@getrheo/flow-runtime';

export type BuildTerminalSnapshotInput = {
  terminal: 'completed' | 'abandoned';
  resolved: SdkResolveResponse;
  state: FlowState;
  subject: { appUserId: string; customUserId?: string; sessionId?: string };
  appVersion?: string;
  customProperties?: Record<string, string>;
  includeManifest: boolean;
  includePath: boolean;
  includeAnswerDetail: boolean;
};

const pickCorrelation = (resolved: SdkResolveResponse) => ({
  channelId: resolved.channelId,
  flowId: resolved.flowId,
  versionId: resolved.versionId,
  assignmentVersion: resolved.assignmentVersion,
  environment: resolved.environment,
  experimentId: resolved.experimentId,
  variantId: resolved.variantId,
});

/** Builds the payload forwarded to `useFlow` terminal callbacks (`onFlowCompleted` / `onFlowAbandoned`). */
export const buildTerminalSnapshot = (input: BuildTerminalSnapshotInput): FlowTerminalSnapshot => {
  const {
    terminal,
    resolved,
    state,
    subject,
    appVersion,
    customProperties,
    includeManifest,
    includePath,
    includeAnswerDetail,
  } = input;

  const strippedRaw = stripAuthResponsesForTerminalExport(state.responses);
  const answers: Record<string, unknown> = {};
  for (const [k, r] of Object.entries(strippedRaw)) {
    const v = stepResponseToCompletionValue(r);
    if (v !== undefined) answers[k] = v;
  }

  const flowManifest = state.manifest;
  const visitedScreenIds = new Set<string>();
  const registerVisited = (id: string | null) => {
    if (!id) return;
    const screen = findScreen(flowManifest, id);
    if (screen) visitedScreenIds.add(screen.id);
  };
  for (const hid of state.history) registerVisited(hid);
  registerVisited(state.currentScreenId);
  for (const screenId of visitedScreenIds) {
    const screen = findScreen(flowManifest, screenId);
    if (!screen) continue;
    for (const fk of collectAnswerCaptureFieldKeysFromScreen(screen)) {
      if (!(fk in answers)) answers[fk] = null;
    }
  }

  const traits: Record<string, unknown> = { ...state.session.sdkAttributes };

  const path = includePath ? [...state.history] : undefined;

  let answersDetail: Record<string, unknown> | undefined;
  if (includeAnswerDetail) {
    answersDetail = {};
    for (const [k, v] of Object.entries(strippedRaw)) {
      answersDetail[k] = v as unknown;
    }
  }

  const manifest: FlowManifest | undefined = includeManifest ? resolved.manifest : undefined;

  const device: FlowTerminalSnapshot['device'] = {
    locale: state.session.locale,
    platform: state.session.platform,
    ...(appVersion !== undefined ? { appVersion } : {}),
    ...(customProperties !== undefined
      ? {
          customProperties: Object.fromEntries(
            Object.entries(customProperties).map(([key, val]) => [key, val]),
          ) as Record<string, string | number | boolean>,
        }
      : {}),
  };

  return {
    schemaVersion: 1,
    terminal,
    occurredAt: state.completedAt,
    correlation: pickCorrelation(resolved),
    subject,
    device,
    answers,
    traits,
    ...(path !== undefined ? { path } : {}),
    ...(answersDetail !== undefined ? { answersDetail } : {}),
    ...(manifest !== undefined ? { manifest } : {}),
  };
};
