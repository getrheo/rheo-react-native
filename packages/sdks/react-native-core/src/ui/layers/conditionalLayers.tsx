import { Fragment } from 'react';
import type { ConditionalLayer } from '@getrheo/contracts';
import {
  conditionalBranchForCaseId,
  resolveConditionalBranch,
  toDecisionEvalCtx,
} from '@getrheo/flow-runtime';
import { type Ctx, type RenderLayer } from '../LayerRendererShared';

/**
 * Renders only the branch a conditional selects — no wrapper view, so the
 * branch stack lays out exactly as it would in place of the conditional.
 */
export const ConditionalView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: ConditionalLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const pinnedCaseId = ctx.conditionalCasePreview?.[layer.id];
  const branch =
    (pinnedCaseId ? conditionalBranchForCaseId(layer, pinnedCaseId) : undefined) ??
    resolveConditionalBranch(
      layer,
      toDecisionEvalCtx({
        locale: ctx.locale,
        platform: ctx.conditionalEval?.platform,
        sdkAttributes: ctx.conditionalEval?.sdkAttributes,
        responses: ctx.conditionalEval?.responses ?? ctx.interpolationContext?.responses,
      }),
    );
  return <Fragment>{renderLayer(branch, ctx)}</Fragment>;
};
