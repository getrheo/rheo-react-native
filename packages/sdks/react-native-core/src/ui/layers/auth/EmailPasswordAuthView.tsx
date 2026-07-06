import { Fragment, useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import type { EmailPasswordAuthLayer, EmailPasswordFieldLayer, EmailPasswordSlot, EmailPasswordSubmitLayer } from '@getrheo/contracts';
import { resolveLocalizedText } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  resolveAndInterpolateLocalizedText,
  resolveButtonLayoutAtWidth,
  resolveButtonStyleAtWidth,
  resolveCommonStyleAtWidth,
  resolveLayerGap,
  resolveTextStyleAtWidth,
} from '@getrheo/flow-runtime';
import {
  rendererEmailPasswordAuthModel,
  rendererEmailPasswordSimInputColors,
} from '@getrheo/renderer-core';
import { useEmailPasswordAuthDispatch } from '../../../emailPasswordAuth';
import { ChromeView, ChoicePressable, type Ctx, type RenderLayer } from '../../LayerRendererShared';
import {
  alignFor,
  buttonPalette,
  commonViewStylePair,
  justifyFor,
  layoutHeightFor,
  mergeButtonInlineLabelStyle,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
  widthFor,
  wrapperLayoutViewStyle,
} from '../../styles';

export const EmailPasswordAuthView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: EmailPasswordAuthLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const dispatchSubmit = useEmailPasswordAuthDispatch();
  const [values, setValues] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const setSlot = useCallback((slot: EmailPasswordSlot) => (t: string) => {
    setError(null);
    setValues((prev) => (prev[slot] === t ? prev : { ...prev, [slot]: t }));
  }, []);
  const setSlotFromNativeEvent = useCallback(
    (slot: EmailPasswordSlot) => (e: NativeSyntheticEvent<{ text: string }>) => {
      const next = e.nativeEvent.text;
      if (typeof next !== 'string') return;
      setError(null);
      setValues((prev) => (prev[slot] === next ? prev : { ...prev, [slot]: next }));
    },
    [],
  );
  const dark = ctx.theme === 'dark';
  const mode = layer.mode;
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
  const gap = resolveLayerGap(layer.kind, layer.gap);
  const simInputColors = rendererEmailPasswordSimInputColors(ctx.theme);

  const inputChrome: React.ComponentProps<typeof TextInput>['style'] = {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    fontSize: 14,
    backgroundColor: simInputColors.background,
    color: dark ? '#fafafa' : '#0a0a0a',
    borderWidth: 1,
    borderColor: simInputColors.border,
  };

  const fire = (): void => {
    setError(null);
    const model = rendererEmailPasswordAuthModel(layer, values);
    if (!model.canSubmit) {
      if (!model.validation.ok) setError(model.validation.message);
      return;
    }
    const payload = {
      kind: 'email_password_auth_resolve' as const,
      layerId: layer.id,
      fieldKey: layer.fieldKey,
      mode: model.mode,
      email: values.email.trim(),
      password: values.password,
      confirmPassword: model.mode === 'sign_up' ? values.confirm : undefined,
      success: true as const,
    };
    if (!ctx.interactive) return;
    if (dispatchSubmit) {
      setPending(true);
      dispatchSubmit({
        manifest: ctx.manifest,
        screenId: ctx.screen.id,
        layerId: layer.id,
        fieldKey: layer.fieldKey,
        mode: model.mode,
        email: values.email,
        password: values.password,
        confirmPassword: model.mode === 'sign_up' ? values.confirm : undefined,
        onSettled: () => setPending(false),
      });
    } else {
      ctx.onRespond?.(payload);
    }
  };

  const alignSelf =
    layer.align === 'end'
      ? 'flex-end'
      : layer.align === 'center'
        ? 'center'
        : layer.align === 'stretch'
          ? 'stretch'
          : 'flex-start';

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

  const childCtxBase: Ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };

  const renderFieldRow = (ch: EmailPasswordFieldLayer): ReactNode => {
    const resolvedField = resolveCommonStyleAtWidth(ch.style, ch.styleBreakpoints, w);
    const ph = ch.placeholder ? resolveLocalizedText(ch.placeholder, ctx.locale) : '';
    const val = values[ch.slot];
    const onChange = setSlot(ch.slot);
    const onNativeChange = setSlotFromNativeEvent(ch.slot);
    const secure = ch.slot === 'password' || ch.slot === 'confirm';
    const kb = ch.slot === 'email' ? ('email-address' as const) : ('default' as const);
    const textContentType =
      ch.slot === 'email'
        ? ('username' as const)
        : ch.slot === 'confirm'
          ? ('password' as const)
          : mode === 'sign_up'
            ? ('newPassword' as const)
            : ('password' as const);
    const autoComplete =
      ch.slot === 'email'
        ? ('email' as const)
        : ch.slot === 'password'
          ? mode === 'sign_up'
            ? ('new-password' as const)
            : ('current-password' as const)
          : ('password' as const);
    const fieldPair = commonViewStylePair(
      stripCommonLayoutForInner(resolvedField),
      ctx.manifest.theme,
      ctx.theme,
      ctx.branding,
    );
    const fieldWrap: ViewStyle = {
      flexDirection: 'column',
      gap: 8,
      ...wrapperLayoutViewStyle(resolvedField),
      ...fieldPair.style,
    };
    return (
      <ChromeView key={ch.id} style={fieldWrap} linearGradient={fieldPair.linearGradient}>
        {ch.children?.map((c) => (
          <Fragment key={c.id}>{renderLayer(c, childCtxBase)}</Fragment>
        ))}
        <TextInput
          editable={ctx.interactive && !pending}
          placeholder={ph}
          value={val}
          onChangeText={onChange}
          onChange={onNativeChange}
          keyboardType={kb}
          secureTextEntry={secure}
          autoCapitalize={ch.slot === 'email' ? 'none' : 'sentences'}
          autoCorrect={false}
          textContentType={textContentType}
          autoComplete={autoComplete}
          placeholderTextColor={dark ? '#71717a' : '#a1a1aa'}
          style={inputChrome}
        />
      </ChromeView>
    );
  };

  const renderSubmitRow = (ch: EmailPasswordSubmitLayer): ReactNode => {
    const layout = resolveButtonLayoutAtWidth(ch, w);
    const btnResolved = resolveButtonStyleAtWidth(ch.style, ch.styleBreakpoints, w);
    const palette = buttonPalette(ch.buttonVariant ?? 'primary', ctx.theme);
    const isVertical = layout.direction === 'vertical';
    const submitPair = commonViewStylePair(
      stripCommonLayoutForInner(btnResolved),
      ctx.manifest.theme,
      ctx.theme,
      ctx.branding,
    );
    const hasAuthorBg =
      submitPair.linearGradient != null || submitPair.style.backgroundColor !== undefined;
    const submitDisabled = !ctx.interactive || pending;
    const outerSubmitSizing: ViewStyle = {
      ...wrapperLayoutViewStyle(btnResolved),
      ...(btnResolved?.position !== 'absolute'
        ? {
            width: widthFor(btnResolved?.width) ?? '100%',
            height: layoutHeightFor(btnResolved?.height),
          }
        : {}),
    };
    const rowCustom: ViewStyle = {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      ...(!hasAuthorBg ? { backgroundColor: palette.background } : {}),
      borderWidth: palette.border === 'transparent' ? 0 : 1,
      borderColor: palette.border === 'transparent' ? undefined : palette.border,
      flexDirection: isVertical ? 'column' : 'row',
      gap: resolveLayerGap(ch.kind, layout.gap),
      alignItems: alignFor(ch.align) ?? 'center',
      justifyContent: justifyFor(ch.distribution) ?? 'center',
      width: '100%',
      ...submitPair.style,
      opacity: ctx.interactive && pending ? 0.6 : undefined,
    };

    return (
      <View key={ch.id} style={outerSubmitSizing}>
        <ChoicePressable
          disabled={submitDisabled}
          style={rowCustom}
          linearGradient={submitPair.linearGradient}
          onPress={fire}
        >
          {pending ? (
            <ActivityIndicator color={palette.color} />
          ) : (
            ch.children.map((c) => {
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
                    <Text style={merged}>
                      {ctx.interpolationContext
                        ? resolveAndInterpolateLocalizedText(c.text, {
                            manifest: ctx.manifest,
                            locale: ctx.locale,
                            responses: ctx.interpolationContext.responses,
                            customProperties: ctx.interpolationContext.customProperties,
                          })
                        : resolveLocalizedText(c.text, ctx.locale)}
                    </Text>
                  </ChromeView>
                );
              }
              return <Fragment key={c.id}>{renderLayer(c, childCtxBase)}</Fragment>;
            })
          )}
        </ChoicePressable>
      </View>
    );
  };

  const errorBannerStyle: ViewStyle = {
    width: '100%',
    maxWidth: '100%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: dark ? 'rgba(248, 113, 113, 0.12)' : 'rgba(220, 38, 38, 0.08)',
    borderWidth: 1,
    borderColor: dark ? 'rgba(248, 113, 113, 0.35)' : 'rgba(185, 28, 28, 0.22)',
  };
  const errorTextStyle = {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    color: dark ? '#fca5a5' : '#b91c1c',
  };

  const fieldChildren = layer.children.filter(
    (ch): ch is EmailPasswordFieldLayer => ch.kind === 'email_password_field',
  );
  const submitChildren = layer.children.filter(
    (ch): ch is EmailPasswordSubmitLayer => ch.kind === 'email_password_submit',
  );

  return (
    <ChromeView style={outerWrap} linearGradient={outerPair.linearGradient}>
      {fieldChildren.map((ch) => renderFieldRow(ch))}
      {error ? (
        <View accessibilityRole="alert" style={errorBannerStyle}>
          <Text style={errorTextStyle}>{error}</Text>
        </View>
      ) : null}
      {submitChildren.map((ch) => renderSubmitRow(ch))}
    </ChromeView>
  );
};
