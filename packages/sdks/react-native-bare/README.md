# @getrheo/react-native-bare

Bare React Native entry for the Rheo SDK. Re-exports `@getrheo/react-native-core` and registers **bare** adapters (`react-native-video`, `react-native-in-app-review`). Do not install alongside `@getrheo/react-native-expo`.

## Install

```bash
pnpm add @getrheo/react-native-bare@3.0.0 \
  react react-native \
  react-native-permissions react-native-gesture-handler react-native-reanimated \
  react-native-linear-gradient react-native-svg lottie-react-native \
  react-native-vector-icons @react-native-async-storage/async-storage \
  react-native-safe-area-context react-native-in-app-review react-native-video
```

Complete native setup for permissions (Info.plist / AndroidManifest) per [react-native-permissions](https://github.com/zoontek/react-native-permissions).

**Integrations (not SDK peers):** `react-native-appsflyer`, `react-native-purchases`, `react-native-purchases-ui`, `@superwall/react-native-superwall` — install only when used.

## Usage

Same API as the Expo flavor (`Flow`, `RheoProvider`, `useFlow`, …). See [`react-native-expo/README.md`](../react-native-expo/README.md) for flow semantics, events, terminal payloads, and production **`apiBaseUrl`** guidance — import from `@getrheo/react-native-bare` instead.

Push uses the same `registerPush` / `unregisterPush` helpers. Bare does not read a token for you. Call `registerPushTokenAdapter` from `@getrheo/react-native-core/platform` with `getDevicePushToken`, or pass `{ token, platform, provider }` to `registerPush`. After a notifications grant the SDK calls `registerPush()` and ignores a missing adapter.

Cross-SDK integration map (RN subpaths vs SwiftUI): [`packages/sdks/docs/CROSS_SDK_INTEGRATION.md`](../docs/CROSS_SDK_INTEGRATION.md).

**Branding fonts:** bare does not auto-download remote faces. Prefer bundling fonts or adding
`expo-font` and registering with `buildBrandingFontLoadMap` keys (`RheoFont__{styleId}`).

## Example

Runnable sample app: [getrheo/rheo-example-bare](https://github.com/getrheo/rheo-example-bare) (private monorepo copy: [`apps/example-bare`](../../../apps/example-bare)).

See the [SDK developer guide](https://docs.getrheo.io/docs/developer-guide/sdk) for integration steps.
