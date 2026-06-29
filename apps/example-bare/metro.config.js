const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { resolve } = require('metro-resolver');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const reactNativeSdkRoots = [
  path.resolve(monorepoRoot, 'packages/sdks/react-native-bare'),
  path.resolve(monorepoRoot, 'packages/sdks/react-native-core'),
].map((root) => path.resolve(root, 'node_modules'));

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    extraNodeModules: {
      '@getrheo/react-native-core': path.resolve(monorepoRoot, 'packages/sdks/react-native-core'),
      '@getrheo/react-native-bare': path.resolve(monorepoRoot, 'packages/sdks/react-native-bare'),
    },
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
      ...reactNativeSdkRoots,
    ],
    disableHierarchicalLookup: true,
  },
};

const mergedConfig = mergeConfig(getDefaultConfig(projectRoot), config);

// @getrheo/react-native-core sources use Node ESM `.js` import specifiers; Metro must map
// those to the `.ts` files in the workspace (no prebuild dist for local dev).
const defaultResolveRequest = mergedConfig.resolver.resolveRequest;

mergedConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolveModule = (name) => {
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, name, platform);
    }
    return resolve(context, name, platform);
  };

  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const base = moduleName.slice(0, -3);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, base]) {
      try {
        return resolveModule(candidate);
      } catch {
        // try next candidate
      }
    }
  }

  return resolveModule(moduleName);
};

module.exports = mergedConfig;
