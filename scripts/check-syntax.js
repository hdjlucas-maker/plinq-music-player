#!/usr/bin/env node
// Checagem de sintaxe de todo o JavaScript do projeto.
// - Arquivos da raiz / scripts/ são CommonJS  -> `node --check arquivo`
// - Arquivos de functions/ são ESM            -> `node --input-type=module --check` via stdin
//
// Uso: npm test

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function checkCommonJS(file) {
  execFileSync(process.execPath, ['--check', file], { stdio: ['ignore', 'ignore', 'pipe'] });
}

function checkESM(file) {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--check'],
    { input: fs.readFileSync(file), stdio: ['pipe', 'ignore', 'pipe'] }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.toString());
  }
}

const esmFiles = walk(path.join(root, 'functions'));
const cjsFiles = [
  'script.js',
  'premium.js',
  'persistence.js',
  'api-client.js',
  'scripts/check-syntax.js',
  'scripts/sync-android-web.js',
].map((p) => path.join(root, p));

for (const file of cjsFiles) {
  if (!fs.existsSync(file)) continue;
  try {
    checkCommonJS(file);
  } catch (err) {
    failures.push({ file, err: err.stderr ? err.stderr.toString() : String(err) });
  }
}

for (const file of esmFiles) {
  try {
    checkESM(file);
  } catch (err) {
    failures.push({ file, err: err.message });
  }
}

if (failures.length) {
  console.error(`Falha na checagem de sintaxe em ${failures.length} arquivo(s):\n`);
  for (const { file, err } of failures) {
    console.error(`  ${path.relative(root, file)}`);
    console.error(String(err).trim().split('\n').map((l) => `    ${l}`).join('\n'));
    console.error('');
  }
  process.exit(1);
}

console.log(`Sintaxe OK: ${cjsFiles.filter((f) => fs.existsSync(f)).length + esmFiles.length} arquivos.`);
