import { Fragment, useState } from 'react';
import { ActivityIndicator, Text, type ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { CommonStyle, CommonStyleBreakpoints, OAuthLoginLayer } from '@getrheo/contracts';
import { oauthLoginManifestProviderFromLayer, oauthPresetEffectiveLabel, resolveLocalizedText } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  resolveAndInterpolateLocalizedText,
  resolveAuthLayoutAtWidth,
  resolveButtonLayoutAtWidth,
  resolveButtonStyleAtWidth,
  resolveCommonStyleAtWidth,
  resolveLayerGap,
  resolveTextStyleAtWidth,
} from '@getrheo/flow-runtime';
import { rendererOAuthLoginAlignAxis, rendererOAuthRowInteractionModel } from '@getrheo/renderer-core';
import { useOAuthLoginDispatch, useOAuthLoginOptional } from '../../../oauthLogin';
import { ChromeView, ChoicePressable, type Ctx, type RenderLayer } from '../../LayerRendererShared';
import {
  alignFor,
  buttonPalette,
  commonViewStylePair,
  justifyFor,
  mergeButtonInlineLabelStyle,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  widthFor,
  wrapperLayoutViewStyle,
} from '../../styles';
import {
  oauthAlignToNative,
  oauthChromeMarginNative,
  oauthChromePaddingNative,
  oauthPresetBrandNative,
  PRESET_PROVIDER_ICON,
} from './oauthNativeChrome';

export const OAuthLoginView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: OAuthLoginLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const dispatchTap = useOAuthLoginDispatch();
  const authPresentation = useOAuthLoginOptional();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const authLayout = resolveAuthLayoutAtWidth(layer, w);
  const gap = resolveLayerGap(layer.kind, authLayout.gap);
  const alignAxis = rendererOAuthLoginAlignAxis(authLayout.align);
  const alignSelf = oauthAlignToNative(alignAxis);
  const muted = ctx.theme === 'dark' ? '#a1a1aa' : '#52525b';

  const outerPair = commonViewStylePair(
    stripCommonLayoutForInner(stripFlowAxesForFlexChild(resolvedOuter, ctx.parentStackDirection)),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const outerWrap: ViewStyle = {
    width: resolvedOuter?.position === 'absolute' ? undefined : '100%',
    alignSelf,
    gap,
    ...outerPair.style,
    ...(outerPair.linearGradient ? { overflow: 'hidden' } : {}),
  };

  return (
    <ChromeView style={outerWrap} linearGradient={outerPair.linearGradient}>
      {authPresentation ? (
        <Text style={{ fontSize: 12, color: muted }}>
          Signed in - pick a provider to finish this step.
        </Text>
      ) : null}
      {layer.children.map((ch) => {
        const rowKey = ch.id;
        const provPayload = oauthLoginManifestProviderFromLayer(ch);
        const { disabled, busy } = rendererOAuthRowInteractionModel({
          interactive: ctx.interactive,
          pendingRowKey: pendingKey,
          rowKey,
        });
        if (ch.variant === 'preset') {
          const resolvedChrome = resolveCommonStyleAtWidth(
            ch.style as CommonStyle | undefined,
            ch.styleBreakpoints as CommonStyleBreakpoints | undefined,
            w,
          );
          const brand = oauthPresetBrandNative(ch.provider, ctx.theme);
          const rowStyle: ViewStyle = {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: alignAxis === 'stretch' ? '100%' : widthFor(resolvedChrome?.width),
            alignSelf: oauthAlignToNative(alignAxis),
            borderRadius: resolvedChrome?.radius ?? 10,
            ...oauthChromePaddingNative(resolvedChrome?.padding),
            ...oauthChromeMarginNative(resolvedChrome?.margin),
            ...brand.container,
            opacity: disabled && ctx.interactive ? 0.5 : undefined,
          };
          const labelLt = oauthPresetEffectiveLabel(ch.provider, ch.label);
          const label = ctx.interpolationContext
            ? resolveAndInterpolateLocalizedText(labelLt, {
                manifest: ctx.manifest,
                locale: ctx.locale,
                responses: ctx.interpolationContext.responses,
                customProperties: ctx.interpolationContext.customProperties,
              })
            : resolveLocalizedText(labelLt, ctx.locale);
          return (
            <ChoicePressable
              key={rowKey}
              disabled={disabled}
              style={rowStyle}
              onPress={() => {
                if (!ctx.interactive) return;
                if (pendingKey) return;
                setPendingKey(rowKey);
                const onSettled = (): void => {
                  setPendingKey(null);
                };
                if (dispatchTap) {
                  dispatchTap({
                    manifest: ctx.manifest,
                    screenId: ctx.screen.id,
                    layerId: layer.id,
                    provider: provPayload,
                    onSettled,
                  });
                } else {
                  ctx.onRespond?.({
                    kind: 'oauth_login_resolve',
                    layerId: layer.id,
                    provider: provPayload,
                    success: true,
                  });
                  onSettled();
                }
              }}
            >
              {busy ? (
                <ActivityIndicator color={brand.busyColor} />
              ) : (
                <Ionicons
                  name={PRESET_PROVIDER_ICON[ch.provider]}
                  size={22}
                  color={brand.iconColor}
                />
              )}
              <Text
                style={{
                  color: brand.labelColor,
                  fontWeight: '600',
                  fontSize: ch.provider === 'apple' ? 17 : 15,
                  textAlign: 'center',
                  flexShrink: 1,
                }}
              >
                {label}
              </Text>
            </ChoicePressable>
          );
        }
        const custom = ch;
        const layout = resolveButtonLayoutAtWidth(custom, w);
        const btnResolved = resolveButtonStyleAtWidth(custom.style, custom.styleBreakpoints, w);
        const palette = buttonPalette(custom.buttonVariant ?? 'secondary', ctx.theme);
        const isVertical = layout.direction === 'vertical';
        const btnPair = commonViewStylePair(
          stripCommonLayoutForInner(btnResolved),
          ctx.manifest.theme,
          ctx.theme,
          ctx.branding,
        );
        const hasAuthorBg =
          btnPair.linearGradient != null || btnPair.style.backgroundColor !== undefined;
        const rowCustom: ViewStyle = {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          ...(!hasAuthorBg ? { backgroundColor: palette.background } : {}),
          borderWidth: palette.border === 'transparent' ? 0 : 1,
          borderColor: palette.border === 'transparent' ? undefined : palette.border,
          flexDirection: isVertical ? 'column' : 'row',
          gap: resolveLayerGap(custom.kind, layout.gap),
          alignItems: alignFor(custom.align) ?? 'center',
          justifyContent: justifyFor(custom.distribution) ?? 'center',
          width: '100%',
          ...wrapperLayoutViewStyle(btnResolved),
          ...btnPair.style,
          opacity: disabled && ctx.interactive ? 0.5 : undefined,
        };
        const oauthChildCtx: Ctx = { ...ctx, isRegionRoot: false };
        return (
          <ChoicePressable
            key={rowKey}
            disabled={disabled}
            style={rowCustom}
            linearGradient={btnPair.linearGradient}
            onPress={() => {
              if (!ctx.interactive) return;
              if (pendingKey) return;
              setPendingKey(rowKey);
              const onSettled = (): void => {
                setPendingKey(null);
              };
              if (dispatchTap) {
                dispatchTap({
                  manifest: ctx.manifest,
                  screenId: ctx.screen.id,
                  layerId: layer.id,
                  provider: provPayload,
                  onSettled,
                });
              } else {
                ctx.onRespond?.({
                  kind: 'oauth_login_resolve',
                  layerId: layer.id,
                  provider: provPayload,
                  success: true,
                });
                onSettled();
              }
            }}
          >
            {busy ? (
              <ActivityIndicator color={palette.color} />
            ) : (
              custom.children.map((c) => {
                if (c.kind === 'text') {
                  const childResolved = resolveTextStyleAtWidth(c.style, c.styleBreakpoints, w);
                  const merged = mergeButtonInlineLabelStyle(
                    palette,
                    btnResolved,
                    childResolved,
                    ctx.manifest.theme,
                    ctx.theme,
                    ctx.branding,
                    ctx.fontScale,
                  );
                  const textPair = commonViewStylePair(
                    stripCommonLayoutForInner(childResolved),
                    ctx.manifest.theme,
                    ctx.theme,
                    ctx.branding,
                  );
                  return (
                    <ChromeView
                      key={c.id}
                      style={{
                        ...wrapperLayoutViewStyle(childResolved),
                        ...textPair.style,
                        ...(childResolved?.position !== 'absolute'
                          ? { width: widthFor(childResolved?.width) }
                          : {}),
                      }}
                      linearGradient={textPair.linearGradient}
                    >
                      <Text style={merged}>{resolveLocalizedText(c.text, ctx.locale)}</Text>
                    </ChromeView>
                  );
                }
                return <Fragment key={c.id}>{renderLayer(c, oauthChildCtx)}</Fragment>;
              })
            )}
          </ChoicePressable>
        );
      })}
    </ChromeView>
  );
};
