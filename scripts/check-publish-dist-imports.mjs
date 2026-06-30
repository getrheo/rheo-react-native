#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RELATIVE_IMPORT_RE = /\bfrom\s+(['"])(\.\.?[^'"]+)\1/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*(['"])(\.\.?[^'"]+)\1\s*\)/g;

const resolveImportTarget = (fromFile, spec) => {
  const base = resolve(dirname(fromFile), spec);
  if (existsSync(base)) return base;
  if (existsSync(`${base}.js`)) return `${base}.js`;
  if (existsSync(join(base, 'index.js'))) return join(base, 'index.js');
  return null;
};

const collectRelativeImports = (content) => {
  const specs = new Set();
  for (const re of [RELATIVE_IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    for (const match of content.matchAll(re)) {
      specs.add(match[2]);
    }
  }
  return [...specs];
};

/**
 * @param {string} repoRoot
 * @param {{ name: string; dir: string; expectsDist?: boolean }[]} packages
 * @returns {string[]}
 */
export const checkPublishDistImports = (repoRoot, packages) => {
  const errors = [];

  for (const { name, dir, expectsDist = true } of packages) {
    if (!expectsDist) continue;

    const distDir = join(repoRoot, dir, 'dist');
    if (!existsSync(distDir)) {
      errors.push(`${name}: dist/ missing — run pnpm build:publish-graph`);
      continue;
    }

    const jsFiles = globSync('**/*.js', { cwd: distDir }).map((f) => join(distDir, f));
    for (const file of jsFiles) {
      const content = readFileSync(file, 'utf8');
      for (const spec of collectRelativeImports(content)) {
        const target = resolveImportTarget(file, spec);
        if (target === null) {
          const relFile = file.replace(`${repoRoot}/`, '');
          errors.push(`${name}: ${relFile} imports missing ${spec}`);
        }
      }
    }
  }

  return errors;
};

const runCli = async () => {
  const { PUBLISH_PACKAGES } = await import('./publish-package-registry.mjs');
  const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const errors = checkPublishDistImports(repoRoot, PUBLISH_PACKAGES);

  if (errors.length > 0) {
    console.error('publish dist import check failed:');
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
  }

  const distPackages = PUBLISH_PACKAGES.filter((p) => p.expectsDist).length;
  console.log(`publish dist import check passed (${distPackages} packages)`);
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
