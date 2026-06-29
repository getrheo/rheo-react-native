import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ViewStyle } from 'react-native';
import type { CarouselLayer } from '@getrheo/contracts';
import {
  rendererCarouselAdvanceIndex,
  rendererCarouselIndexFromScrollOffset,
  rendererCarouselLayoutModel,
  rendererCarouselPageDotsModel,
  rendererCarouselScrollOffset,
  rendererCarouselShouldEmitComplete,
  rendererCarouselSlideIndex,
  rendererCarouselSlideWidth,
  type RendererCarouselAlignAxis,
} from '@getrheo/renderer-core';
import { ChromeView, type Ctx, type RenderLayer } from '../LayerRendererShared';
import {
  borderStyle,
  commonViewStylePair,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
} from '../styles';

const carouselAlignToNative = (axis: RendererCarouselAlignAxis): ViewStyle['alignItems'] => {
  if (axis === 'start') return 'flex-start';
  if (axis === 'end') return 'flex-end';
  return 'center';
};

const PageDots = ({
  layer,
  idx,
  ctx,
}: {
  layer: CarouselLayer;
  idx: number;
  ctx: Ctx;
}) => {
  const model = rendererCarouselPageDotsModel({
    layer,
    activeIndex: idx,
    theme: ctx.theme,
    manifestTheme: ctx.manifest.theme,
  });
  if (!model.visible) return null;

  const pc = layer.pageControl;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: model.spacing,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: pc?.padding?.t,
        paddingRight: pc?.padding?.r,
        paddingBottom: pc?.padding?.b,
        paddingLeft: pc?.padding?.l,
        marginTop: pc?.margin?.t,
        marginRight: pc?.margin?.r,
        marginBottom: pc?.margin?.b,
        marginLeft: pc?.margin?.l,
        ...borderStyle(pc?.border, ctx.manifest.theme, ctx.theme),
        ...model.containerSurface.nativeShadow,
      }}
    >
      {model.dots.map((dot, i) => (
        <View
          key={i}
          style={{
            width: dot.width,
            height: dot.height,
            borderRadius: dot.borderRadius,
            backgroundColor: dot.backgroundColor,
            opacity: dot.opacity,
            borderWidth: dot.borderWidth,
            borderColor: dot.borderColor,
          }}
        />
      ))}
    </View>
  );
};

export const CarouselView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: CarouselLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const layout = rendererCarouselLayoutModel(layer);
  const initialIdx = rendererCarouselSlideIndex(layer, layout.slideCount);
  const [idx, setIdx] = useState(initialIdx);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollerRef = useRef<ScrollView | null>(null);
  const prevIdxRef = useRef(initialIdx);
  const slideWidth = rendererCarouselSlideWidth(containerWidth, layout.peek);

  const maybeEmitComplete = (previousIndex: number, index: number) => {
    if (
      !ctx.interactive ||
      !ctx.onRespond ||
      !rendererCarouselShouldEmitComplete(previousIndex, index, layout.slideCount, layout.loop)
    ) {
      return;
    }
    ctx.onRespond({ kind: 'carousel' });
  };

  useEffect(() => {
    if (!layer.autoAdvance) return;
    const t = setInterval(() => {
      setIdx((cur) => {
        const next = rendererCarouselAdvanceIndex(cur, layout.slideCount, layout.loop);
        maybeEmitComplete(cur, next);
        prevIdxRef.current = next;
        return next;
      });
    }, layout.autoAdvanceMs);
    return () => clearInterval(t);
  }, [layer.autoAdvance, layout.autoAdvanceMs, layout.loop, layout.slideCount]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || slideWidth <= 0) return;
    el.scrollTo({
      x: rendererCarouselScrollOffset(idx, slideWidth, layout.spacing),
      animated: true,
    });
  }, [idx, slideWidth, layout.spacing]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (slideWidth <= 0) return;
    const next = rendererCarouselIndexFromScrollOffset(
      e.nativeEvent.contentOffset.x,
      slideWidth,
      layout.spacing,
      layout.slideCount,
    );
    if (next === null || next === idx) return;
    maybeEmitComplete(idx, next);
    prevIdxRef.current = next;
    setIdx(next);
  };

  const dotsModel = rendererCarouselPageDotsModel({
    layer,
    activeIndex: idx,
    theme: ctx.theme,
    manifestTheme: ctx.manifest.theme,
  });
  const dots = <PageDots layer={layer} idx={idx} ctx={ctx} />;
  const carPair = commonViewStylePair(
    stripCommonLayoutForInner(stripFlowAxesForFlexChild(layer.style, ctx.parentStackDirection)),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );

  return (
    <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <ChromeView
        style={{
          flexDirection: 'column',
          gap: 8,
          ...carPair.style,
        }}
        linearGradient={carPair.linearGradient}
      >
        {dotsModel.position === 'top' && dots}
        <ScrollView
          ref={scrollerRef}
          horizontal
          pagingEnabled={layout.peek === 0 && layout.spacing === 0}
          showsHorizontalScrollIndicator={false}
          snapToInterval={slideWidth + layout.spacing}
          decelerationRate="fast"
          onMomentumScrollEnd={onScroll}
          contentContainerStyle={{
            alignItems: carouselAlignToNative(layout.alignAxis),
            paddingLeft: layout.peek,
            paddingRight: layout.peek,
          }}
        >
          {layer.slides.map((s, i) => (
            <View
              key={s.id}
              style={{
                width: slideWidth,
                marginRight: i < layout.slideCount - 1 ? layout.spacing : 0,
              }}
            >
              <Fragment key={s.id}>{renderLayer(s, ctx)}</Fragment>
            </View>
          ))}
        </ScrollView>
        {dotsModel.position !== 'top' && dots}
      </ChromeView>
    </View>
  );
};
