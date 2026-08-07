import { Fragment, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DateTimeInputLayer, DateTimeInputMode } from '@getrheo/contracts';
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
import {
  dateTimeInputMode,
  defaultDateTimeInputValue,
} from '@getrheo/flow-runtime/dateTimeInputValidation';
import { scaleAuthoredFontSize } from '@getrheo/renderer-core';
import { useScreenInputDraft } from '@getrheo/flow-ui-state/draft';
import { ChromeView, type Ctx, type RenderLayer } from '../LayerRendererShared';
import {
  commonViewStylePair,
  stripCommonLayoutForInner,
  stripFlowAxesForFlexChild,
} from '../styles';

/** UIDatePicker spinner intrinsic height; without this Yoga often collapses the native view to 0. */
const IOS_SPINNER_HEIGHT = 216;
/** Spinner content does not center when stretched to full width — use the classic wheel width. */
const IOS_SPINNER_WIDTH = 320;

const pad2 = (n: number): string => String(n).padStart(2, '0');

const formatIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatIsoTime = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const formatIsoValue = (mode: DateTimeInputMode, d: Date): string => {
  if (mode === 'date') return formatIsoDate(d);
  if (mode === 'time') return formatIsoTime(d);
  return `${formatIsoDate(d)}T${formatIsoTime(d)}`;
};

const parseIsoValue = (mode: DateTimeInputMode, value: string): Date => {
  const now = new Date();
  if (!value) return now;
  if (mode === 'date') {
    const parts = value.split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const day = parts[2];
    if (y === undefined || m === undefined || day === undefined) return now;
    return new Date(y, m - 1, day, 12, 0, 0, 0);
  }
  if (mode === 'time') {
    const parts = value.split(':').map(Number);
    const h = parts[0];
    const mi = parts[1];
    if (h === undefined || mi === undefined) return now;
    const d = new Date();
    d.setHours(h, mi, 0, 0);
    return d;
  }
  const sep = value.indexOf('T');
  if (sep < 0) return now;
  const dateParts = value.slice(0, sep).split('-').map(Number);
  const timeParts = value.slice(sep + 1).split(':').map(Number);
  const y = dateParts[0];
  const m = dateParts[1];
  const day = dateParts[2];
  const h = timeParts[0];
  const mi = timeParts[1];
  if (
    y === undefined ||
    m === undefined ||
    day === undefined ||
    h === undefined ||
    mi === undefined
  ) {
    return now;
  }
  return new Date(y, m - 1, day, h, mi, 0, 0);
};

const parseBoundDate = (mode: DateTimeInputMode, bound: string | undefined): Date | undefined => {
  if (!bound) return undefined;
  return parseIsoValue(mode, bound);
};

type PickerPhase = 'date' | 'time';

export const DateTimeInputView = ({
  layer,
  ctx,
  renderLayer,
}: {
  layer: DateTimeInputLayer;
  ctx: Ctx;
  renderLayer: RenderLayer;
}) => {
  const draftCtx = useScreenInputDraft();
  const insets = useSafeAreaInsets();
  const mode = dateTimeInputMode(layer);
  const initialValue = defaultDateTimeInputValue(layer) ?? '';
  const value = draftCtx?.draft?.kind === 'date_time' ? draftCtx.draft.value : initialValue;
  const placeholder = layer.placeholder
    ? resolveLocalizedText(layer.placeholder, ctx.locale)
    : mode === 'date'
      ? 'Select date'
      : mode === 'time'
        ? 'Select time'
        : 'Select date and time';
  const placeholderColor = textInputDefaultChromeColors(ctx.theme).placeholder;
  const childCtx: Ctx = { ...ctx, isRegionRoot: false, regionKind: undefined };

  const w = ctx.previewWidthPx ?? DEFAULT_PREVIEW_VIEWPORT_WIDTH_PX;
  const resolvedOuter = resolveCommonStyleAtWidth(layer.style, layer.styleBreakpoints, w);
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
  const fieldPair = commonViewStylePair(fieldChrome, ctx.manifest.theme, ctx.theme, ctx.branding);
  const field = resolveTextInputFieldForRender(
    { fieldStyle: layer.fieldStyle },
    ctx.manifest.theme,
    ctx.theme,
  );
  const fontScale = ctx.fontScale ?? 1;
  const fieldTextStyle = {
    fontFamily: resolveNativeTextFontFamilyName(ctx.branding, field.fontFamily, field.fontWeight),
    fontSize: scaleAuthoredFontSize(field.fontSizePx, fontScale) ?? field.fontSizePx,
    fontWeight: field.fontWeight ? (String(field.fontWeight) as '400' | '600' | '700') : undefined,
    color: field.color,
    opacity: field.opacity,
    textAlign: field.textAlign as 'left' | 'center' | 'right' | undefined,
  };

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<PickerPhase>(mode === 'time' ? 'time' : 'date');
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  const selectedDate = parseIsoValue(mode, value);
  const minimumDate = parseBoundDate(mode, layer.min);
  const maximumDate = parseBoundDate(mode, layer.max);

  const commit = (next: Date) => {
    draftCtx?.setDraft({ kind: 'date_time', value: formatIsoValue(mode, next) });
  };

  const openPicker = () => {
    if (!ctx.interactive) return;
    setPendingDate(null);
    setPhase(mode === 'time' ? 'time' : 'date');
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    setPendingDate(null);
  };

  const onChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      closePicker();
      return;
    }
    if (!date) {
      if (Platform.OS === 'android') closePicker();
      return;
    }

    if (mode === 'datetime' && Platform.OS === 'android') {
      if (phase === 'date') {
        setPendingDate(date);
        setPhase('time');
        return;
      }
      const base = pendingDate ?? selectedDate;
      const merged = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        date.getHours(),
        date.getMinutes(),
        0,
        0,
      );
      commit(merged);
      closePicker();
      return;
    }

    commit(date);
    if (Platform.OS === 'android') closePicker();
  };

  const pickerMode: 'date' | 'time' | 'datetime' =
    mode === 'datetime' && Platform.OS === 'ios'
      ? 'datetime'
      : phase === 'time' || mode === 'time'
        ? 'time'
        : 'date';

  const sheetBg = ctx.theme === 'dark' ? '#18181b' : '#f4f4f5';
  const sheetText = ctx.theme === 'dark' ? '#fafafa' : '#18181b';

  return (
    <View style={{ flexDirection: 'column', gap: 8, ...outerPair.style }}>
      {layer.children?.map((c) => (
        <Fragment key={c.id}>{renderLayer(c, childCtx)}</Fragment>
      ))}
      <ChromeView style={fieldPair.style} linearGradient={fieldPair.linearGradient}>
        <Pressable
          disabled={!ctx.interactive}
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
        >
          <Text
            style={{
              backgroundColor: 'transparent',
              ...fieldTextStyle,
              color: value ? fieldTextStyle.color : placeholderColor,
            }}
          >
            {value || placeholder}
          </Text>
        </Pressable>
      </ChromeView>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={
            phase === 'time' && pendingDate
              ? new Date(
                  pendingDate.getFullYear(),
                  pendingDate.getMonth(),
                  pendingDate.getDate(),
                  selectedDate.getHours(),
                  selectedDate.getMinutes(),
                )
              : selectedDate
          }
          mode={pickerMode === 'datetime' ? 'date' : pickerMode}
          display="default"
          onChange={onChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" onRequestClose={closePicker}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={closePicker}
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: 'rgba(0,0,0,0.35)',
              }}
            />
            <View
              style={{
                backgroundColor: sheetBg,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingBottom: Math.max(24, insets.bottom),
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  paddingHorizontal: 16,
                  paddingTop: 12,
                }}
              >
                <Pressable onPress={closePicker} accessibilityRole="button">
                  <Text style={{ color: sheetText, fontSize: 17, fontWeight: '600' }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode={pickerMode}
                display="spinner"
                onChange={onChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                themeVariant={ctx.theme === 'dark' ? 'dark' : 'light'}
                style={{
                  width: IOS_SPINNER_WIDTH,
                  height: IOS_SPINNER_HEIGHT,
                  alignSelf: 'center',
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};
