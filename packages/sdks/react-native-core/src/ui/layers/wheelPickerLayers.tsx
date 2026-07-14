import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import type { WheelPickerLayer } from '@getrheo/contracts';
import { resolveLocalizedText } from '@getrheo/contracts';
import { buildWheelPickerItems, type WheelPickerItem } from '@getrheo/flow-runtime/wheelPickerItems';
import { resolveWheelPickerForRender } from '@getrheo/flow-runtime/wheelPickerStyle';
import { resolveNativeTextFontFamilyName, scaleAuthoredFontSize } from '@getrheo/renderer-core';
import { useScreenInputDraft } from '@getrheo/flow-ui-state/draft';
import { DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX, resolveCommonStyleAtWidth } from '@getrheo/flow-runtime';
import { ChromeView, type Ctx, type RenderLayer } from '../LayerRendererShared';
import {
  commonViewStylePair,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
} from '../styles';

const clampIndex = (index: number, max: number): number =>
  Math.max(0, Math.min(max, index));

const opacityForDistance = (distance: number): number => {
  if (distance <= 0) return 1;
  if (distance === 1) return 0.55;
  if (distance === 2) return 0.3;
  return 0.15;
};

type WheelColumnProps = {
  items: WheelPickerItem[];
  selectedId: string | null;
  itemHeightPx: number;
  visibleItemCount: number;
  selectionBackgroundColor: string;
  placeholder: string;
  itemTextStyle: ViewStyle & { fontSize?: number };
  selectedTextStyle: ViewStyle & { fontSize?: number };
  interactive: boolean;
  onSelect: (id: string) => void;
};

const WheelColumn = ({
  items,
  selectedId,
  itemHeightPx,
  visibleItemCount,
  selectionBackgroundColor,
  placeholder,
  itemTextStyle,
  selectedTextStyle,
  interactive,
  onSelect,
}: WheelColumnProps) => {
  const listRef = useRef<FlatList<WheelPickerItem>>(null);
  const selectedIndex = useMemo(() => {
    const idx = items.findIndex((item) => item.id === selectedId);
    return idx >= 0 ? idx : Math.floor(items.length / 2);
  }, [items, selectedId]);
  const [centeredIndex, setCenteredIndex] = useState(selectedIndex);
  const edgePadding = ((visibleItemCount - 1) / 2) * itemHeightPx;
  const wheelHeight = itemHeightPx * visibleItemCount;

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      const clamped = clampIndex(index, Math.max(0, items.length - 1));
      listRef.current?.scrollToOffset({
        offset: clamped * itemHeightPx,
        animated,
      });
      setCenteredIndex(clamped);
    },
    [itemHeightPx, items.length],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = clampIndex(Math.round(offsetY / itemHeightPx), Math.max(0, items.length - 1));
      setCenteredIndex(index);
      const item = items[index];
      if (item) onSelect(item.id);
    },
    [itemHeightPx, items, onSelect],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<WheelPickerItem>) => {
      const distance = Math.abs(index - centeredIndex);
      const selected = index === centeredIndex;
      const label = selected && !selectedId ? placeholder : item.label;
      return (
        <View
          style={{
            height: itemHeightPx,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: opacityForDistance(distance),
          }}
        >
          <Text
            style={{
              ...(selected ? selectedTextStyle : itemTextStyle),
              fontWeight: selected ? '600' : '400',
            }}
          >
            {label}
          </Text>
        </View>
      );
    },
    [
      centeredIndex,
      itemHeightPx,
      itemTextStyle,
      placeholder,
      selectedId,
      selectedTextStyle,
    ],
  );

  return (
    <View style={{ height: wheelHeight, width: '100%', position: 'relative' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: edgePadding,
          height: itemHeightPx,
          borderRadius: 10,
          backgroundColor: selectionBackgroundColor,
          zIndex: 1,
        }}
      />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeightPx}
        decelerationRate="fast"
        scrollEnabled={interactive}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: edgePadding }}
        getItemLayout={(_, index) => ({
          length: itemHeightPx,
          offset: itemHeightPx * index + edgePadding,
          index,
        })}
        initialScrollIndex={selectedIndex}
        onLayout={() => scrollToIndex(selectedIndex, false)}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      />
    </View>
  );
};

export const WheelPickerView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: WheelPickerLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const items = useMemo(
    () => buildWheelPickerItems(layer, ctx.locale),
    [layer, ctx.locale],
  );
  const selectedId =
    draftCtx?.draft?.kind === 'wheel'
      ? draftCtx.draft.value
      : items[Math.floor(items.length / 2)]?.id ?? null;
  const placeholder = layer.placeholder
    ? resolveLocalizedText(layer.placeholder, ctx.locale)
    : 'Select';
  const wheel = resolveWheelPickerForRender(layer, ctx.manifest.theme, ctx.theme, placeholder);
  const fontScale = ctx.fontScale ?? 1;
  const toTextStyle = (text: typeof wheel.item) => {
    const fontFamily = resolveNativeTextFontFamilyName(
      ctx.branding,
      text.fontFamily,
      text.fontWeight,
    );
    const fontSize = scaleAuthoredFontSize(text.fontSizePx, fontScale) ?? text.fontSizePx;
    return {
      fontFamily,
      fontSize,
      fontWeight: text.fontWeight
        ? (String(text.fontWeight) as '400' | '600' | '700')
        : undefined,
      color: text.color,
      opacity: text.opacity,
      textAlign: 'center' as const,
    };
  };
  const childCtx: Ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const wheelPair = commonViewStylePair(
    stripCommonLayoutForInner(stripFlowAxesForFlexChild(resolvedOuter, ctx.parentStackDirection)),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );

  return (
    <ChromeView
      style={{
        flexDirection: 'column',
        gap: 8,
        ...wheelPair.style,
      }}
      linearGradient={wheelPair.linearGradient}
    >
      {layer.children?.map((child) => (
        <Fragment key={child.id}>{renderLayer(child, childCtx)}</Fragment>
      ))}
      <WheelColumn
        items={items}
        selectedId={selectedId}
        itemHeightPx={wheel.itemHeightPx}
        visibleItemCount={wheel.visibleItemCount}
        selectionBackgroundColor={wheel.selectionBackgroundColor}
        placeholder={wheel.placeholder}
        itemTextStyle={toTextStyle(wheel.item)}
        selectedTextStyle={toTextStyle(wheel.selectedItem)}
        interactive={ctx.interactive}
        onSelect={(id) => draftCtx?.setDraft({ kind: 'wheel', value: id })}
      />
    </ChromeView>
  );
};
