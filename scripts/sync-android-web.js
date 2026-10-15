const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'www');
const files = [
  'index.html',
  'style.css',
  'script.js',
  'persistence.js',
  'api-client.js',
  'account-gate.js',
  'premium.js',
];

fs.mkdirSync(webDir, { recursive: true });
for (const name of files) {
  fs.copyFileSync(path.join(root, name), path.join(webDir, name));
}

const indexPath = path.join(webDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<script>window\.PlinqNativeApp = true;<\/script>\s*/g, '');
const apiClientTag = '<script src="api-client.js"></script>';
if (!html.includes(apiClientTag)) {
  throw new Error('index.html precisa carregar api-client.js para o app Android.');
}
html = html.replace(apiClientTag, `<script>window.PlinqNativeApp = true;</script>\n${apiClientTag}`);
fs.writeFileSync(indexPath, html);

execFileSync('npx', ['cap', 'copy', 'android'], { cwd: root, stdio: 'inherit' });
