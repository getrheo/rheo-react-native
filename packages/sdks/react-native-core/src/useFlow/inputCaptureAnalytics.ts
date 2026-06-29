import { findInputLayer } from '@getrheo/flow-runtime';
import type { Screen } from '@getrheo/contracts/screens';
import type { SdkResolveResponse } from '@getrheo/contracts';
import type { StepResponse } from '@getrheo/flow-runtime';
import type { TrackEventInput } from '../events.js';

export type EnqueueSdkFn = (input: TrackEventInput) => void;

/** Fire choice_selected / text_submitted for a captured input before step_completed. */
export const enqueueInputCaptureAnalytics = (
  enqueueSdk: EnqueueSdkFn,
  data: SdkResolveResponse,
  previousScreenId: string | null,
  screen: Screen | undefined,
  cap: StepResponse,
): void => {
  if (!previousScreenId) return;
  const input = screen ? findInputLayer(screen) : null;
  if (cap.kind === 'choice' && input && 'fieldKey' in input) {
    enqueueSdk({
      name: 'choice_selected',
      flowId: data.flowId,
      versionId: data.versionId,
      experimentId: data.experimentId,
      variantId: data.variantId,
      stepId: previousScreenId,
      properties: { field_key: input.fieldKey, value: cap.choiceId },
    });
  } else if (cap.kind === 'multiChoice' && input && 'fieldKey' in input) {
    for (const choiceId of cap.choiceIds) {
      enqueueSdk({
        name: 'choice_selected',
        flowId: data.flowId,
        versionId: data.versionId,
        experimentId: data.experimentId,
        variantId: data.variantId,
        stepId: previousScreenId,
        properties: { field_key: input.fieldKey, value: choiceId },
      });
    }
  } else if (cap.kind === 'text' && input && 'fieldKey' in input) {
    enqueueSdk({
      name: 'text_submitted',
      flowId: data.flowId,
      versionId: data.versionId,
      experimentId: data.experimentId,
      variantId: data.variantId,
      stepId: previousScreenId,
      properties: { field_key: input.fieldKey, value: cap.value },
      fieldClassification: cap.classification,
    });
  } else if (cap.kind === 'scale' && input && 'fieldKey' in input) {
    enqueueSdk({
      name: 'text_submitted',
      flowId: data.flowId,
      versionId: data.versionId,
      experimentId: data.experimentId,
      variantId: data.variantId,
      stepId: previousScreenId,
      properties: { field_key: input.fieldKey, value: String(cap.value) },
      fieldClassification: 'safe',
    });
  }
};
