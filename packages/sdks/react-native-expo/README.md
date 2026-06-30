# @getrheo/react-native-expo

Expo and Expo dev-client entry for the Rheo React Native SDK. Re-exports `@getrheo/react-native-core` and registers **Expo** adapters (`expo-video`, `expo-store-review`). Install **one** flavor: not `@getrheo/react-native-bare`.

React + React Native SDK for Rheo. The state machine lives in `@getrheo/flow-runtime` and schemas live in `@getrheo/contracts`; only rendering is platform-specific.

## Usage

The publishable key identifies an app and environment (test or live). Pick a
**channel** per flow surface (`channelId` on `<Flow />` or on
`useFlow({ channelId })`); that channel decides which flow version the SDK
serves. You no longer pass a flow id to `useFlow`.

### Production

The SDK default **`apiBaseUrl`** is **`https://api.getrheo.io`**. Omit it in production unless you self-host. When using **`ob_pk_live_*`** keys, never point at localhost.

```tsx
<RheoProvider
  config={{
    publishableKey: 'ob_pk_live_xxx',
    apiBaseUrl: 'https://api.getrheo.io', // optional — matches default
    userId: 'u_1',
  }}
>
```

### Identity

- **`userId`** (optional): Primary id for analytics and experiment bucketing.
  When omitted on **web**, the SDK generates a UUID once and stores it under
  `localStorage['rheo_app_user_id']`. In other runtimes (Node, SSR) it
  uses an in-memory singleton until you pass an explicit `userId` — **React
  Native** hosts should set `userId` (e.g. from AsyncStorage) until a storage
  adapter ships.
- **`attribution`** (optional): When **not** set to `{ enabled: false }`, the SDK
  can listen for **`react-native-appsflyer`** when your app installs it (not an SDK peer — integration only) and uses required peer **`@react-native-async-storage/async-storage`** after **channel resolve succeeds**,
  but only when the workspace plan allows it (`features.attribution` on the resolve
  response — **Indie** plans receive `false`) **and** AppsFlyer is enabled for the app
  in **App settings → Integrations** (`integrations.appsflyer.enabled` on the resolve
  response). Normalized install + deep-link payloads
  become **universal `sdkAttributes` keys** (`acquisition.*`, `link.*`, `attribution.*`).
  Values merge **on top of** host `sdkAttributes` for decision nodes. A **24h device cache**
  (namespaced by `userId`) fills gaps when a cold open delivers no MMP payload;
  **live callbacks always override** the cache. Pass `attribution: { storage: null }`
  to disable persistence, or `providers: []` to disable all MMP adapters while
  keeping the hook dormant. Add more providers later via `attribution.providers`.
- **`customUserId`** (optional): Your backend’s user id; sent as
  `identity.customUserId` on every flushed event alongside `appUserId`, so the
  dashboard can join to your systems. Optionally set once on `RheoProvider`;
  **`useRheoCustomUserId()`** exposes `setCustomUserId()` so CRM ids can change
  at runtime (updates apply to queued events **at flush** time).

```tsx
import { Flow, RheoProvider, useRheoCustomUserId } from '@getrheo/react-native-expo';

function Screen() {
  const { setCustomUserId } = useRheoCustomUserId();
  // ...
  return (
    <Flow
      channelId="ch_test_a1b2c3d4"
      theme="dark"
      onFlowCompleted={() => setCustomUserId('crm_known_user')}
    />
  );
}

const App = () => (
  <RheoProvider
    config={{
      publishableKey: 'ob_pk_test_xxx',
      customUserId: 'crm_initial',
      userId: 'u_1',
      sessionId: 'sess_xyz',
      appVersion: '1.4.0',
    }}
  >
    <Screen />
  </RheoProvider>
);
```

`<Flow />` is the fully managed React Native renderer — it resolves
the channel's flow, draws every layer kind (stack / text / image / button /
single-choice / multi-choice / text input / carousel), and emits the full
event taxonomy. Drop down to `useFlow({ channelId })` + `<LayerRenderer />` if
you need custom chrome.

### Terminal payloads (`onFlowCompleted` / `onFlowAbandoned`)

Callbacks receive a versioned **`FlowTerminalSnapshot`** (`schemaVersion: 1`) meant for **`JSON.stringify` → your API**, CRM, or LLM prompts:

- **`terminal`**: `completed` | `abandoned`
- **`occurredAt`**: terminal timestamp (`FlowState.completedAt`)
- **`correlation`**: join keys only — `channelId`, `flowId`, `versionId`, `assignmentVersion`, `environment`, `experimentId`, `variantId` (no dashboard integration flags)
- **`subject`**: `appUserId`, optional `customUserId`, optional `sessionId`
- **`device`**: `locale`, `platform`, optional `appVersion`, optional `customProperties`
- **`answers`**: normalized field-key → value using `stepResponseToCompletionValue` for every stored step response (except stripped auth keys), plus **`null`** for any capture field on a **visited** screen (history + current screen) that never received a response—**input layers** (`single_choice`, `multiple_choice`, `text_input`, `scale_input`), **checkbox** field keys, **OS permission** synthetic keys (`permission:*`), and **app review** keys (`app_review:{layerId}`). Same completion rules as `buildCompletionResponses` for keys that do have responses.
- **`traits`**: single merged map used for decisions at terminal time (host + attribution + runtime patches)

Optional (all default **false** on `useFlow` / `<Flow />`):

- **`includeManifestInTerminalPayload`** → `manifest`
- **`includePathInTerminalPayload`** → `path` (walked screen / surface ids)
- **`includeAnswerDetailInTerminalPayload`** → `answersDetail` (raw step responses minus auth keys)

Migration from **`onFlowFinished`**: use **`onFlowCompleted`** / **`onFlowAbandoned`**; use **`payload.terminal`** if one shared handler must branch.

Explicit **`abandon()`** transitions to **`abandoned`**, enqueues **`flow_abandoned`** once, then runs **`onFlowAbandoned`**. Unmounting mid-flow still enqueues **`flow_abandoned`** when status was not already terminal (no duplicate when already **`abandoned`**).

## How resolution works

1. `useFlow({ channelId })` `POST /v1/sdk/resolve` with the SDK identity. Two headers are
   required: `Authorization: Bearer <publishableKey>` and
   `X-Rheo-Channel: <channelId>`.
2. The server looks up the channel and returns the manifest from either:
   - the channel's pinned version (`assignmentKind: "direct"`), or
   - one of the running experiment's variant arms, deterministically bucketed
     by `(experimentId, appUserId)` (`assignmentKind: "experiment"`).
3. The response always includes `flowId`, `versionId`, `versionNumber`,
   `assignmentVersion`, `channelId` and (when applicable) `experimentId` /
   `variantId`. These are forwarded on every analytics event so funnels stay
   attributable across version changes.
4. **`mediaMap`** maps each referenced `mediaAssetId` (image / lottie layers) to
   its public CDN URL. `<Flow />` and `useFlow` pass this through to
   `LayerRenderer` automatically; custom UIs should pass `mediaMap` from
   `useFlow` (or your resolve result) into `LayerRenderer`.

### Caching

The resolve response carries an `ETag` of the form `"{assignmentVersion}-{versionId}"`.
`useFlow` loads a per-channel cache from AsyncStorage and sends `If-None-Match` only
when a validated entry exists; `304` reuses the cached manifest. `assignmentVersion`
is incremented on every channel pointer change, so re-validation is essentially free.

### Resolve fallback

When `POST /v1/sdk/resolve` fails (network outage, 4xx/5xx, or any resolve error), `<Flow />` can show a **host-owned escape hatch** instead of blocking the user:

- Pass optional **`fallback`** (`ReactNode`) — your hardcoded offline onboarding (or any UI). Full-bleed; **no Rheo telemetry** on that surface; the SDK does not wire retry into host fallback (remount the screen to re-resolve).
- Omit **`fallback`** — the SDK shows a default screen: **"Error to load the content"** and a **Try again** button that calls **`useFlow().retry()`** (loading spinner while resolve runs).

`useFlow` exposes **`resolveFailed`** (`!loading && error && !manifest`), **`error`** (for logging), and **`retry()`**. Custom UIs branch on `resolveFailed` and render their own fallback.

Resolve still re-runs automatically on mount when `channelId` or identity deps change. After a successful resolve, terminal states (`completed` / `abandoned`) render nothing in `<Flow />` — navigate away in `onFlowCompleted` / `onFlowAbandoned`.

### Failure modes

| Status | code                         | Typed error                       | Meaning                                                  |
|--------|------------------------------|-----------------------------------|----------------------------------------------------------|
| 400    | `channel_required`           | `RheoChannelRequiredError`   | The `X-Rheo-Channel` header was missing.            |
| 404    | `channel_not_found`          | `RheoChannelNotFoundError`   | Unknown channel id, or wrong env for this publishable key. |
| 410    | `channel_archived`           | `RheoChannelArchivedError`   | Channel was archived in the dashboard. Unarchive to resume. |
| 404    | `channel_unassigned`         | —                                 | Channel has no flow assigned yet — set one in the dashboard. |
| 404    | `version_missing`            | —                                 | Channel pin references a version that was deleted.       |
| 404    | `experiment_not_running`     | —                                 | Channel pin references an experiment that's draft/stopped. |
| 400    | `variant_pin_invalid`        | —                                 | One of the experiment's variants has no version pinned.  |

> Experiments in `pending_decision` (auto-paused at their end date) are still
> served — bucketing stays frozen until an operator promotes a winner or
> extends the end date.

## Events & batching

Every interaction emits a typed event. Events are queued in memory and
POSTed to `/v1/sdk/events` either every 5 seconds, when the buffer hits
500 events, or immediately on `flow_completed` / `flow_abandoned` (so
funnel terminals are never lost to a flush window). When the queue holds
events for more than one channel, the SDK splits them into separate POSTs
(one `X-Rheo-Channel` header per batch, per API contract).

| Event             | When it fires                                         | Properties                          |
|-------------------|-------------------------------------------------------|-------------------------------------|
| `flow_started`    | Once per resolved flow on first mount                 | —                                   |
| `step_viewed`     | When the rendered screen changes                      | —                                   |
| `step_completed`  | After a non-terminal screen submission (not skip)      | —                                   |
| `step_skipped`    | When the flow records a skip response (e.g. skip button) | —                                 |
| `choice_selected` | Per option for single-/multi-choice submissions       | `field_key`, `value`                |
| `text_submitted`  | When a text input screen is submitted                 | `field_key`, `value` (+ classification) |
| `flow_completed`  | When the flow reaches its terminal screen             | `responseCount`                     |
| `flow_abandoned`  | When **`useFlow().abandon()`** runs while running, **or** when the surface unmounts before completion (`completed` / `abandoned`) | —                                   |

`text_submitted` events carry a `fieldClassification` so the API redacts
sensitive values before they reach ClickHouse.

## In-app review (`request_app_review`)

Uses required peer **`expo-store-review`**: `hasAction()` → `requestReview()`, telemetry events, **~1.5s** delay when shown, then advance via default next. OS declines → **`not_shown`**.

```bash
npx expo install expo-store-review
```

## Breaking change (built-in OS permissions)

Host apps must **stop** configuring `onOsPermission` on `RheoProvider` — it no longer exists. When a flow button uses **`request_os_permission`**, the SDK invokes [`react-native-permissions`](https://github.com/zoontek/react-native-permissions) and advances the manifest using **granted**, **denied**, or **blocked** outcomes:

| `permissionKey`   | Native call (summary) |
|-------------------|------------------------|
| `notifications`   | `requestNotifications` (`POST_NOTIFICATIONS` on Android 13+) |
| `camera`          | `request` (`CAMERA`) |
| `microphone`      | `request` (`RECORD_AUDIO` / microphone) |
| `photo_library`   | `request` (`READ_MEDIA_IMAGES` on Android; `PHOTO_LIBRARY` on iOS) |
| `contacts`        | `request` (`READ_CONTACTS` / `CONTACTS`) |
| `calendar`        | `request` (`READ_CALENDAR`; `CALENDARS` on iOS — read/write access tier per Apple setup) |

Missing peer, missing native setup for the specific capability, or **web** → the SDK resolves **denied** (development builds log hints where applicable).

Additional built-in handlers will ship per `permissionKey` without bringing back a host hook.

### Native checklist (engineering, per app)

- **Bare React Native**: add optional peer **`react-native-permissions`**. For each capability you ship in flows, add the matching entries to iOS **`setup_permissions`** and Android **`AndroidManifest.xml`**, plus the **Info.plist** usage descriptions the upstream README lists (for example **`NSPhotoLibraryUsageDescription`**, **`NSCalendarsFullAccessUsageDescription`** for calendar). Notifications still need **`POST_NOTIFICATIONS`** on Android 13+.
- **Expo**: configure plugin **`react-native-permissions`** and **`ios.infoPlist` / `android.permissions`** for every capability you ship in flows, run **`expo prebuild`** when regenerating native projects, **`pod install`**, rebuild the dev client. Older Android releases may still need **`READ_EXTERNAL_STORAGE`** for photo-library–style prompts if your `minSdk`/`targetSdk` require it. Push token registration stays app-specific beyond notification authorization.
- **Growth / dashboard**: branches are authored only in the builder; **no handler code**.

Requesting authorization is separate from registering for remote push tokens; token plumbing stays in the application if you alert server-side campaigns.

---

## Required peer dependencies (install with the SDK)

One install — all peers are **required** for the Expo flavor (no optional meta). **`@react-native-community/slider`** ships as a direct dependency of core.

```bash
pnpm add @getrheo/react-native-expo@2.0.3 \
  react react-native \
  react-native-permissions react-native-gesture-handler react-native-reanimated \
  react-native-linear-gradient react-native-svg lottie-react-native \
  react-native-vector-icons @react-native-async-storage/async-storage \
  react-native-safe-area-context expo-store-review expo-video
```

**Integrations (not SDK peers):** install **`react-native-appsflyer`** and/or **`react-native-purchases`** + **`react-native-purchases-ui`** only when you use attribution or RevenueCat paywall steps.

**Branding fonts:** use `buildBrandingFontLoadMap(branding)` from this package, then register faces with `expo-font` or linked assets.

## Runnable example

Runnable sample app: [getrheo/rheo-example-expo](https://github.com/getrheo/rheo-example-expo) (private monorepo copy: [`apps/example-expo`](../../../apps/example-expo)).

See the [SDK developer guide](https://docs.getrheo.io/docs/developer-guide/sdk) for integration steps and production configuration.
