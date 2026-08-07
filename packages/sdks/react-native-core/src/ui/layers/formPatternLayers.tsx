import { Fragment, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  AddressInputLayer,
  DateTimeInputLayer,
  PhoneInputLayer,
} from '@getrheo/contracts';
import { resolveLocalizedText } from '@getrheo/contracts';
import {
  DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX,
  resolveCommonStyleAtWidth,
  resolveNativeTextFontFamilyName,
} from '@getrheo/flow-runtime';
import {
  resolveTextInputFieldChromeStyle,
  resolveTextInputFieldForRender,
  stripTextInputFieldChromeFromStyle,
  textInputDefaultChromeColors,
} from '@getrheo/flow-runtime/textInputStyle';
import { scaleAuthoredFontSize } from '@getrheo/renderer-core';
import {
  defaultPhoneCountryCode,
  filterPhoneNationalInput,
} from '@getrheo/flow-runtime/phoneInputValidation';
import {
  addressVisibleFields,
  emptyAddressValue,
} from '@getrheo/flow-runtime/addressInputValidation';
import { COUNTRY_DIAL_ENTRIES } from '@getrheo/flow-runtime/countryDialCodes';
import { useScreenInputDraft } from '@getrheo/flow-ui-state/draft';
import { ChromeView, type Ctx, type RenderLayer } from '../LayerRendererShared';
import {
  commonViewStylePair,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
} from '../styles';

export { DateTimeInputView } from './dateTimeInputLayers';
export { NumberStepperView } from './numberStepperLayers';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const useFieldChrome = (layer: { style?: unknown; styleBreakpoints?: unknown }, ctx: Ctx) => {
  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(
    (layer as DateTimeInputLayer).style,
    (layer as DateTimeInputLayer).styleBreakpoints,
    w,
  );
  const outerPair = commonViewStylePair(
    stripCommonLayoutForInner(
      stripFlowAxesForFlexChild(
        stripTextInputFieldChromeFromStyle(resolvedOuter),
        ctx.parentStackDirection,
      ),
    ),
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  const fieldChrome = resolveTextInputFieldChromeStyle(resolvedOuter, ctx.theme);
  const fieldPair = commonViewStylePair(
    fieldChrome,
    ctx.manifest.theme,
    ctx.theme,
    ctx.branding,
  );
  return { resolvedOuter, outerPair, fieldPair };
};

const useFieldTextStyle = (
  layer: DateTimeInputLayer | PhoneInputLayer | AddressInputLayer,
  ctx: Ctx,
) => {
  const field = resolveTextInputFieldForRender(
    { fieldStyle: layer.fieldStyle },
    ctx.manifest.theme,
    ctx.theme,
  );
  const fontScale = ctx.fontScale ?? 1;
  const fontFamily = resolveNativeTextFontFamilyName(ctx.branding, field.fontFamily, field.fontWeight);
  const fontSize = scaleAuthoredFontSize(field.fontSizePx, fontScale) ?? field.fontSizePx;
  return {
    fontFamily,
    fontSize,
    fontWeight: field.fontWeight ? (String(field.fontWeight) as '400' | '600' | '700') : undefined,
    color: field.color,
    opacity: field.opacity,
    textAlign: field.textAlign as 'left' | 'center' | 'right' | undefined,
  };
};

// ---------------------------------------------------------------------------
// PhoneInputView
// ---------------------------------------------------------------------------

export const PhoneInputView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: PhoneInputLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const [pickerOpen, setPickerOpen] = useState(false);
  const countryCode =
    draftCtx?.draft?.kind === 'phone'
      ? draftCtx.draft.countryCode
      : defaultPhoneCountryCode(layer);
  const nationalNumber =
    draftCtx?.draft?.kind === 'phone' ? draftCtx.draft.nationalNumber : '';

  const allowedCodes = layer.allowedCountryCodes;
  const entries = allowedCodes
    ? COUNTRY_DIAL_ENTRIES.filter((e) => allowedCodes.includes(e.code))
    : COUNTRY_DIAL_ENTRIES;
  const selectedEntry = entries.find((e) => e.code === countryCode) ?? entries[0];

  const placeholder = layer.placeholder
    ? resolveLocalizedText(layer.placeholder, ctx.locale)
    : 'Phone number';
  const placeholderColor = textInputDefaultChromeColors(ctx.theme).placeholder;
  const childCtx: Ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };
  const { outerPair, fieldPair } = useFieldChrome(layer, ctx);
  const fieldTextStyle = useFieldTextStyle(layer, ctx);
  const pickerBg = ctx.theme === 'dark' ? '#18181b' : '#f4f4f5';
  const pickerText = ctx.theme === 'dark' ? '#fafafa' : '#18181b';
  const pickerHighlight = ctx.theme === 'dark' ? '#27272a' : '#e4e4e7';

  return (
    <View style={{ flexDirection: 'column', gap: 8, ...outerPair.style }}>
      {layer.children?.map((c) => (
        <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
      ))}
      <ChromeView style={fieldPair.style} linearGradient={fieldPair.linearGradient}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => ctx.interactive && setPickerOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingRight: 8,
              borderRightWidth: 1,
              borderRightColor: ctx.theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
            }}
            accessibilityLabel={`Country code ${selectedEntry?.label ?? ''}`}
          >
            <Text style={fieldTextStyle}>
              {selectedEntry ? `+${selectedEntry.dial}` : '+1'}
            </Text>
            <Text style={{ ...fieldTextStyle, fontSize: 10, opacity: 0.5 }}>▼</Text>
          </Pressable>
          <TextInput
            editable={ctx.interactive}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            value={nationalNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
            onChangeText={(next) => {
              const filtered = filterPhoneNationalInput(next);
              draftCtx?.setDraft(
                filtered === '' && nationalNumber === ''
                  ? null
                  : {
                      kind: 'phone',
                      countryCode,
                      nationalNumber: filtered,
                    },
              );
            }}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              borderWidth: 0,
              padding: 0,
              margin: 0,
              ...fieldTextStyle,
            }}
          />
        </View>
      </ChromeView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setPickerOpen(false)}
        >
          <View
            style={{
              backgroundColor: pickerBg,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: 360,
            }}
          >
            <ScrollView>
              {entries.map((entry) => (
                <Pressable
                  key={entry.code}
                  onPress={() => {
                    draftCtx?.setDraft({ kind: 'phone', countryCode: entry.code, nationalNumber });
                    setPickerOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    backgroundColor: entry.code === countryCode ? pickerHighlight : 'transparent',
                  }}
                >
                  <Text style={{ color: pickerText, fontWeight: '600', minWidth: 40 }}>
                    +{entry.dial}
                  </Text>
                  <Text style={{ color: pickerText, flex: 1 }}>{entry.label}</Text>
                  <Text style={{ color: pickerText, opacity: 0.5 }}>{entry.code}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

// ---------------------------------------------------------------------------
// AddressInputView
// ---------------------------------------------------------------------------

const ADDRESS_FIELD_LABELS: Record<string, string> = {
  line1: 'Street address',
  line2: 'Apartment, suite, etc.',
  city: 'City',
  region: 'State / Region',
  postalCode: 'Postal code',
  country: 'Country',
};

export const AddressInputView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: AddressInputLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const addr =
    draftCtx?.draft?.kind === 'address'
      ? draftCtx.draft.value
      : emptyAddressValue(layer);
  const visible = addressVisibleFields(layer);
  const placeholderColor = textInputDefaultChromeColors(ctx.theme).placeholder;
  const childCtx: Ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };
  const { outerPair, fieldPair } = useFieldChrome(layer, ctx);
  const fieldTextStyle = useFieldTextStyle(layer, ctx);
  const gap = layer.gap ?? 8;

  const update = (field: string, val: string) => {
    const next = { ...addr, [field]: val };
    draftCtx?.setDraft({ kind: 'address', value: next });
  };

  return (
    <View style={{ flexDirection: 'column', gap: 8, ...outerPair.style }}>
      {layer.children?.map((c) => (
        <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
      ))}
      <View style={{ flexDirection: 'column', gap }}>
        {visible.map((field) => {
          const raw = addr[field as keyof typeof addr] ?? '';
          const placeholderText =
            layer.placeholders?.[field as keyof typeof layer.placeholders]
              ? resolveLocalizedText(
                  layer.placeholders[field as keyof typeof layer.placeholders]!,
                  ctx.locale,
                )
              : ADDRESS_FIELD_LABELS[field] ?? field;
          return (
            <ChromeView key={field} style={fieldPair.style} linearGradient={fieldPair.linearGradient}>
              <TextInput
                editable={ctx.interactive}
                placeholder={placeholderText}
                placeholderTextColor={placeholderColor}
                value={raw}
                autoCapitalize={field === 'country' ? 'characters' : 'words'}
                maxLength={field === 'country' ? 2 : undefined}
                onChangeText={(val) => update(field, val)}
                style={{
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  padding: 0,
                  margin: 0,
                  ...fieldTextStyle,
                }}
              />
            </ChromeView>
          );
        })}
      </View>
    </View>
  );
};
