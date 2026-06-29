import type { ConsumedDraftPayload } from '@getrheo/flow-runtime/stateMachine';

export type NativeButtonActionMeta = {
  layerId?: string;
  /** Draft + checkboxes for `request_app_review` (submitted via `screen_commit` after the prompt). */
  screenCommit?: {
    checkboxValues: Record<string, boolean>;
    capturedDraft?: ConsumedDraftPayload;
  };
};
