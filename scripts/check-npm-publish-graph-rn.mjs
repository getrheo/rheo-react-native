#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPublishDistImports } from './check-publish-dist-imports.mjs';

const repoRoot = join(new URL('.', import.meta.url).pathname, '..');

const PUBLISH_PACKAGES = [
  { name: '@getrheo/react-native-core', dir: 'packages/sdks/react-native-core' },
  { name: '@getrheo/react-native-expo', dir: 'packages/sdks/react-native-expo' },
  { name: '@getrheo/react-native-bare', dir: 'packages/sdks/react-native-bare' },
];

const targetVersion = process.env.TARGET_VERSION ?? JSON.parse(
  readFileSync(join(repoRoot, PUBLISH_PACKAGES[0].dir, 'package.json'), 'utf8'),
).version;

const errors = [];

for (const { name, dir } of PUBLISH_PACKAGES) {
  const pkgPath = join(repoRoot, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.version !== targetVersion) {
    errors.push(`${name}: version ${pkg.version} !== ${targetVersion}`);
  }
  if (!pkg.repository?.url) errors.push(`${name}: missing repository.url`);
  if (!existsSync(join(repoRoot, dir, 'dist/index.js'))) {
    errors.push(`${name}: dist/index.js missing — run pnpm build`);
  }
}

errors.push(...checkPublishDistImports(repoRoot, PUBLISH_PACKAGES));

if (errors.length > 0) {
  console.error('npm publish graph check failed:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`npm publish graph check passed (${PUBLISH_PACKAGES.length} packages @ ${targetVersion})`);
