# rheo-react-native

Public home for the **Rheo React Native SDK** — channel resolve, `Flow` rendering, analytics, and optional integrations.

## Packages

| npm | Platform |
| --- | --- |
| [`@getrheo/react-native-expo`](https://www.npmjs.com/package/%40getrheo%2Freact-native-expo) | Expo / dev client |
| [`@getrheo/react-native-bare`](https://www.npmjs.com/package/%40getrheo%2Freact-native-bare) | Bare React Native |
| [`@getrheo/react-native-core`](https://www.npmjs.com/package/%40getrheo%2Freact-native-core) | Shared implementation (transitive) |

**Current release line:** `2.3.0.x` (publish on git tag `v2.3.0`).

**Compatibility:** requires [`@getrheo/contracts@2.x`](https://www.npmjs.com/package/%40getrheo%2Fcontracts) and matching [`rheo-js`](https://github.com/getrheo/rheo-js) packages (pulled transitively on install).

## Install

```bash
# Expo
npm install @getrheo/react-native-expo

# Bare React Native
npm install @getrheo/react-native-bare
```

Production apps can omit `apiBaseUrl` — the SDK defaults to `https://api.getrheo.io`.

## Example apps

- [rheo-example-expo](https://github.com/getrheo/rheo-example-expo)
- [rheo-example-bare](https://github.com/getrheo/rheo-example-bare)

## Development

```bash
pnpm install
pnpm verify
```

[Documentation](https://docs.getrheo.io/docs/developer-guide/sdk) · [CONTRIBUTING](./CONTRIBUTING.md) · [MIT](./LICENSE)
