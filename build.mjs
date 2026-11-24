// Zero-dependency bundler that stitches our ES modules + CSS into a single self-contained HTML file
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });

// Ordered dependency graph (each file's imports/exports stripped cleanly into a single IIFE scope)
const order = [
  'math.js',
  'textures.js',
  'engine.js',
  'audio.js',
  'weapons.js',
  'characters.js',
  'enemies.js',
  'levels.js',
  'game.js',
  'ui.js',
  'main.js',
];

let bundledJs = '(function(){\n"use strict";\n';
for (const file of order) {
  let code = fs.readFileSync(path.join(srcDir, file), 'utf8');
  // Strip local ESM imports and export keywords
  code = code.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  code = code.replace(/^\s*export\s+(?=(const|let|var|function|class)\s)/gm, '');
  bundledJs += `\n// --- ${file} ---\n` + code + '\n';
}
bundledJs += '\n})();\n';

const css = fs.readFileSync(path.join(srcDir, 'style.css'), 'utf8');
let html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
html = html.replace('/*__INLINE_CSS__*/', () => css);
html = html.replace('/*__INLINE_JS__*/', () => bundledJs);

const outPath = path.join(distDir, 'vanguard-2089.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`Built ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
