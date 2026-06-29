# @rheo/example-bare

Minimal **bare React Native** host for `@getrheo/react-native-bare`. Use this to validate
`react-native-video`, `react-native-in-app-review`, and required peers without Expo modules.

## Prerequisites

- Local API on port 4000 (`pnpm dev:local` from repo root)
- Native projects: from this directory, scaffold once if `ios/` / `android/` are missing:

```bash
npx @react-native-community/cli@latest init RheoExampleBare --directory . --skip-install
```

Then `pnpm install` from the monorepo root.

## Install (host app)

```bash
pnpm add @getrheo/react-native-bare
# Plus all required peers listed in packages/sdks/react-native-bare/README.md
```

## Run

```bash
pnpm --filter @rheo/example-bare start
pnpm --filter @rheo/example-bare ios
# or android
```

Enter publishable key, channel id, and API URL on the config screen, then tap **Start flow**.

**Hide navigation bar in flow:** when enabled, the host header (title and back to config) is hidden while `<Flow />` runs. Default off.
