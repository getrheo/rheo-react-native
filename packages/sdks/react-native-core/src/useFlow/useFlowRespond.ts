import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  buildCompletionResponses,
  findManualSubmitInputLayer,
  findScreen,
  submitResponse,
  type DecisionEvaluationTelemetry,
  type FlowState,
  type StepResponse,
} from '@getrheo/flow-runtime';
import { appReviewCaptureFieldKey, permissionCaptureFieldKey } from '@getrheo/contracts/layers';
import { isEligibleConsumedDraft } from '@getrheo/flow-runtime/stateMachine';
import type { SdkResolveResponse } from '@getrheo/contracts';
import { enqueueInputCaptureAnalytics, type EnqueueSdkFn } from './inputCaptureAnalytics.js';

export { enqueueInputCaptureAnalytics } from './inputCaptureAnalytics.js';

export type UseFlowRespondParams = {
  stateRef: MutableRefObject<FlowState | null>;
  resolvedRef: MutableRefObject<SdkResolveResponse | null>;
  setState: Dispatch<SetStateAction<FlowState | null>>;
  enqueueSdk: EnqueueSdkFn;
  enqueueDecisionEvaluated: (payload: DecisionEvaluationTelemetry) => void;
};

export const useFlowRespond = ({
  stateRef,
  resolvedRef,
  setState,
  enqueueSdk,
  enqueueDecisionEvaluated,
}: UseFlowRespondParams) =>
  useCallback(
    (r: StepResponse) => {
      const prev = stateRef.current;
      const data = resolvedRef.current;
      if (!prev || !data) return;
      const previousScreenId = prev.currentScreenId;
      const screen = previousScreenId
        ? findScreen(prev.manifest, previousScreenId)
        : undefined;
      const manualInput = screen ? findManualSubmitInputLayer(screen) : null;
      const analyticsSource: StepResponse = r.kind === 'screen_commit' ? r.primary : r;
      const navKind = r.kind === 'screen_commit' ? r.primary.kind : r.kind;

      if (r.kind === 'go_back') {
        const next = submitResponse(prev, r, { onDecisionEvaluated: enqueueDecisionEvaluated });
        if (next.currentScreenId === prev.currentScreenId) return;
        setState(next);
        stateRef.current = next;
        return;
      }

      if (r.kind === 'end_flow' && r.consumedDraft) {
        enqueueInputCaptureAnalytics(
          enqueueSdk,
          data,
          previousScreenId,
          screen,
          r.consumedDraft,
        );
      }

      if (r.kind === 'screen_commit' && r.capturedDraft && isEligibleConsumedDraft(r.capturedDraft)) {
        enqueueInputCaptureAnalytics(
          enqueueSdk,
          data,
          previousScreenId,
          screen,
          r.capturedDraft,
        );
      }

      if (
        analyticsSource.kind === 'choice' ||
        analyticsSource.kind === 'multiChoice' ||
        analyticsSource.kind === 'text' ||
        analyticsSource.kind === 'scale'
      ) {
        enqueueInputCaptureAnalytics(
          enqueueSdk,
          data,
          previousScreenId,
          screen,
          analyticsSource,
        );
      } else if (
        r.kind === 'screen_commit' &&
        r.primary.kind === 'app_review_outcome' &&
        previousScreenId
      ) {
        enqueueSdk({
          name: 'text_submitted',
          flowId: data.flowId,
          versionId: data.versionId,
          experimentId: data.experimentId,
          variantId: data.variantId,
          stepId: previousScreenId,
          properties: {
            field_key: appReviewCaptureFieldKey(r.primary.layerId),
            value: r.primary.outcome,
          },
          fieldClassification: 'safe',
        });
      } else if (r.kind === 'permission_outcome' && previousScreenId) {
        enqueueSdk({
          name: 'text_submitted',
          flowId: data.flowId,
          versionId: data.versionId,
          experimentId: data.experimentId,
          variantId: data.variantId,
          stepId: previousScreenId,
          properties: {
            field_key: permissionCaptureFieldKey(r.permissionKey),
            value: r.outcome,
          },
          fieldClassification: 'safe',
        });
      }

      const next = submitResponse(prev, r, { onDecisionEvaluated: enqueueDecisionEvaluated });
      setState(next);
      stateRef.current = next;

      const oauthFailNoAdvance = r.kind === 'oauth_login_resolve' && !r.success;
      const leftRunningStep =
        !!previousScreenId &&
        prev.status === 'running' &&
        !oauthFailNoAdvance &&
        (next.currentScreenId !== previousScreenId || next.status === 'completed');

      if (r.kind === 'skip' && leftRunningStep) {
        enqueueSdk({
          name: 'step_skipped',
          flowId: data.flowId,
          versionId: data.versionId,
          experimentId: data.experimentId,
          variantId: data.variantId,
          stepId: previousScreenId,
          ...(manualInput
            ? {
                properties: {
                  field_key: manualInput.fieldKey,
                  empty_capture: true,
                },
              }
            : {}),
        });
      }

      if (next.status === 'completed') {
        enqueueSdk({
          name: 'flow_completed',
          flowId: data.flowId,
          versionId: data.versionId,
          experimentId: data.experimentId,
          variantId: data.variantId,
          properties: {
            responseCount: Object.keys(buildCompletionResponses(next)).length,
          },
        });
      } else if (previousScreenId && !oauthFailNoAdvance && r.kind !== 'skip') {
        enqueueSdk({
          name: 'step_completed',
          flowId: data.flowId,
          versionId: data.versionId,
          experimentId: data.experimentId,
          variantId: data.variantId,
          stepId: previousScreenId,
          ...(navKind === 'go_to_screen' && manualInput
            ? {
                properties: {
                  field_key: manualInput.fieldKey,
                  empty_capture: true,
                },
              }
            : {}),
        });
      }
    },
    [enqueueDecisionEvaluated, enqueueSdk, resolvedRef, setState, stateRef],
  );
