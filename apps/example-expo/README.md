# @rheo/example-expo

Runnable Expo SDK 55 example for the Rheo SDK. Useful for end-to-end
testing the `@getrheo/react-native-expo` event pipeline against a local API +
ClickHouse stack.

## Setup

From the monorepo root:

```bash
pnpm install

# Option A: API + dashboard only, then boot Expo separately
pnpm dev:local            # boots Postgres + ClickHouse + apps/api on :4000
# (in another terminal)
pnpm --filter @rheo/example-expo start

# Option B: API + dashboard + Expo example, all in one shot
pnpm dev:local:app:react-native
# or stress + dev client:
pnpm dev:local:app:stress:react-native
```

Either way, choose `i` (iOS simulator) or `a` (Android emulator) at the
Expo prompt once it appears.

The first launch shows a config form. Paste:

- a publishable key (`ob_pk_test_…`) you created in the dashboard,
- a channel id (`ch_test_…`) pinned to a published flow,
- the API URL (`http://localhost:4000` for iOS sim, `http://10.0.2.2:4000` for Android emulator),
- any user id you like — it's forwarded as `identity.appUserId`.

Tap **Start flow** to mount `<RheoProvider>` + `<Flow />`
and run the resolved flow.

**Hide navigation bar in flow:** enable on the config screen to hide the Expo Router stack header (title and back) while `<Flow />` runs — useful for full-screen onboarding. Default off (header visible).

**Offline resolve fallback:** enable **Offline resolve fallback** on the config screen (default on). Stop the API or set a bad API URL, then start the flow — you should see the hardcoded `OfflineResolveFallback` UI instead of the live manifest. Turn the toggle off to use the SDK default error (“Error to load the content” + Try again).

## RevenueCat (external surface / paywall steps)

The example app includes `react-native-purchases` and
`react-native-purchases-ui` so flows that contain a **RevenueCat paywall**
node can present the real paywall UI. Rheo still never calls
`Purchases.configure` from the SDK; this host wires it up before
`<Flow />` mounts.

1. In the dashboard: enable **App Settings → Integrations → RevenueCat**,
   publish a flow whose graph includes a RevenueCat paywall (with Fallback
   wired), and pin it to your test channel.
2. Copy `apps/example-expo/.env.example` to `apps/example-expo/.env` and set
   `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and/or
   `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` (public SDK keys from RevenueCat).
3. Run a **custom dev client**, not Expo Go — the native modules do not load
   in Expo Go (the paywall step would resolve as `failed` per SDK behavior).

```bash
pnpm --filter @rheo/example-expo ios
# or
pnpm --filter @rheo/example-expo android
```

After changing native dependencies, run `npx expo prebuild` (or the run
commands above, which apply native changes) so CocoaPods / Gradle pick up
the new packages.

## AppsFlyer (MMP attribution)

The example app depends on `react-native-appsflyer` and registers the Expo
config plugin so install and deep-link callbacks reach `@getrheo/react-native-expo`, which
maps them into `acquisition.*`, `link.*`, and `attribution.*` SDK attributes for
decision nodes (when your workspace plan enables attribution on channel
resolve).

1. Create an app in the [AppsFlyer](https://www.appsflyer.com/) dashboard and
   copy the **dev key**. On iOS you also need the numeric **App Store id**
   (iTunes id) for the same app entry.
2. Add to `apps/example-expo/.env`:

   - `EXPO_PUBLIC_APPSFLYER_DEV_KEY`
   - `EXPO_PUBLIC_APPSFLYER_IOS_APP_ID` (iOS only; omit on Android)

3. Run a **custom dev client** (`pnpm --filter @rheo/example-expo ios` or
   `android`), not Expo Go.

If env vars are missing, onboarding still runs; the console logs a short hint.

## Verifying events

Once you've completed (or abandoned) a flow, query ClickHouse from the
API container:

```sql
SELECT event_name, count() FROM events
WHERE app_id = '<your app uuid>'
  AND environment = 'test'
  AND event_date = today()
GROUP BY event_name;
```

You should see rows for at least `flow_started`, `step_viewed`,
`step_completed`, and `flow_completed`.
