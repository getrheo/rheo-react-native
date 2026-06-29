import {
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import type { MultipleChoiceLayer, SingleChoiceLayer } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  findOptionStackForChoice,
  resolveCommonStyleAtWidth,
  resolveLayerGap,
  screenHasContinueButton,
  applyChoiceOptionSelectionToStack,
} from '@getrheo/flow-runtime';
import { useScreenInputDraft } from '@getrheo/flow-ui-state/draft';
import { ChoicePressable, type Ctx, type RenderLayer } from '../LayerRendererShared';
import {
  buttonPalette,
  commonViewStylePair,
  layoutHeightFor,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  widthFor,
} from '../styles';

type ChoiceLayer = SingleChoiceLayer | MultipleChoiceLayer;

const optionPressDefaultsStyle = (ctx: Ctx): ViewStyle => {
  const palette = buttonPalette('secondary', ctx.theme);
  return {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  };
};

const choiceOuterStyle = (layer: ChoiceLayer, ctx: Ctx): ViewStyle => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolved = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const inner = stripCommonLayoutForInner(
    stripFlowAxesForFlexChild(resolved, ctx.parentStackDirection),
  );
  const { style: common, linearGradient } = commonViewStylePair(
    inner,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const isAbsolute = resolved?.position === 'absolute';
  const inFlex = ctx.parentStackDirection !== undefined;
  const directWidth = isAbsolute || inFlex ? undefined : widthFor(resolved?.width);
  const directHeight =
    isAbsolute || inFlex ? undefined : layoutHeightFor(resolved?.height);
  return {
    ...common,
    ...(directWidth !== undefined ? { width: directWidth } : {}),
    ...(directHeight !== undefined ? { height: directHeight } : {}),
    overflow: linearGradient ? 'hidden' : undefined,
  };
};

const choiceLayout = (
  layer: ChoiceLayer,
): { container: ViewStyle; item: ViewStyle | undefined } => {
  const gap = resolveLayerGap(layer.kind, layer.gap);
  if (layer.direction === 'grid') {
    const columns = Math.max(1, layer.columns ?? 2);
    const widthPct = `${(100 / columns).toFixed(4)}%` as `${number}%`;
    return {
      container: { flexDirection: 'row', flexWrap: 'wrap', gap },
      item: { width: widthPct, flexGrow: 0, flexShrink: 0 },
    };
  }
  return {
    container: {
      flexDirection: layer.direction === 'horizontal' ? 'row' : 'column',
      gap,
    },
    item: undefined,
  };
};

const stackWithSelectedStyle = applyChoiceOptionSelectionToStack;

const ChoiceOptionRow = ({
  parent,
  optionId,
  ctx,
  isSelected,
  onPress,
  itemStyle,
  renderLayer,
}: {
  parent: ChoiceLayer;
  optionId: string;
  ctx: Ctx;
  isSelected: boolean;
  onPress: () => void;
  itemStyle?: ViewStyle;
  renderLayer: RenderLayer;
}) => {
  const stack = findOptionStackForChoice(parent, optionId);
  if (!stack) return null;
  const styled = stackWithSelectedStyle(
    stack,
    isSelected,
    ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  );
  const hasAuthoredLook =
    !!stack.style?.background ||
    !!stack.style?.border ||
    !!stack.style?.padding ||
    !!stack.selectedStyle;
  const baseStyle = hasAuthoredLook ? undefined : optionPressDefaultsStyle(ctx);
  const merged: ViewStyle | undefined =
    itemStyle && baseStyle
      ? { ...baseStyle, ...itemStyle }
      : (itemStyle ?? baseStyle);
  return (
    <ChoicePressable
      disabled={!ctx.interactive}
      style={merged}
      onPress={onPress}
    >
      {renderLayer(styled, {
        ...ctx,
        isRegionRoot: false,
        regionKind: undefined,
        parentStackDirection: parent.direction === 'horizontal' ? 'horizontal' : 'vertical',
      })}
    </ChoicePressable>
  );
};

export const SingleChoiceView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: SingleChoiceLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const manualSubmit = screenHasContinueButton(ctx.screen);
  const selectedId =
    draftCtx?.draft?.kind === 'choice' ? draftCtx.draft.choiceId : null;
  const { container, item } = choiceLayout(layer);

  return (
    <View style={choiceOuterStyle(layer, ctx)}>
      <View style={container}>
        {layer.optionBindings.map((b) => (
          <ChoiceOptionRow
            key={b.optionId}
            parent={layer}
            optionId={b.optionId}
            ctx={ctx}
            isSelected={manualSubmit && selectedId === b.optionId}
            itemStyle={item}
            renderLayer={renderLayer}
            onPress={() => {
              if (manualSubmit) {
                draftCtx?.setDraft({ kind: 'choice', choiceId: b.optionId });
              } else {
                ctx.onRespond?.({ kind: 'choice', choiceId: b.optionId });
              }
            }}
          />
        ))}
      </View>
    </View>
  );
};

export const MultipleChoiceView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: MultipleChoiceLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const selected = new Set(
    draftCtx?.draft?.kind === 'multiChoice' ? draftCtx.draft.choiceIds : [],
  );

  const toggle = (id: string): void => {
    if (!draftCtx) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else {
      const max = layer.maxSelections;
      if (max !== undefined && next.size >= max) return;
      next.add(id);
    }
    draftCtx.setDraft(
      next.size === 0 ? null : { kind: 'multiChoice', choiceIds: Array.from(next) },
    );
  };

  const { container, item } = choiceLayout(layer);

  return (
    <View style={choiceOuterStyle(layer, ctx)}>
      <View style={container}>
        {layer.optionBindings.map((b) => (
          <ChoiceOptionRow
            key={b.optionId}
            parent={layer}
            optionId={b.optionId}
            ctx={ctx}
            isSelected={selected.has(b.optionId)}
            itemStyle={item}
            renderLayer={renderLayer}
            onPress={() => toggle(b.optionId)}
          />
        ))}
      </View>
    </View>
  );
};
