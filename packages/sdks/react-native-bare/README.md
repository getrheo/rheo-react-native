# @getrheo/react-native-bare

Bare React Native entry for the Rheo SDK. Re-exports `@getrheo/react-native-core` and registers **bare** adapters (`react-native-video`, `react-native-in-app-review`). Do not install alongside `@getrheo/react-native-expo`.

## Install

```bash
pnpm add @getrheo/react-native-bare \
  react react-native \
  react-native-permissions react-native-gesture-handler react-native-reanimated \
  react-native-linear-gradient react-native-svg lottie-react-native \
  react-native-vector-icons @react-native-async-storage/async-storage \
  react-native-safe-area-context react-native-in-app-review react-native-video
```

Complete native setup for permissions (Info.plist / AndroidManifest) per [react-native-permissions](https://github.com/zoontek/react-native-permissions).

**Integrations (not SDK peers):** `react-native-appsflyer`, `react-native-purchases`, `react-native-purchases-ui` — install only when used.

## Usage

Same API as the Expo flavor (`Flow`, `RheoProvider`, `useFlow`, …). See [`react-native-expo/README.md`](../react-native-expo/README.md) for flow semantics, events, terminal payloads, and production **`apiBaseUrl`** guidance — import from `@getrheo/react-native-bare` instead.

## Example

See the [SDK developer guide](https://docs.getrheo.io/docs/developer-guide/sdk) for integration steps.
