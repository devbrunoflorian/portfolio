import { readdir, readFile, writeFile, mkdir, rm, realpath, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const destination = path.join(root, '.astro', 'legacy-public');
if (path.relative(root, destination) !== path.join('.astro', 'legacy-public')) throw new Error('Invalid public staging directory.');

async function sourceFiles(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? sourceFiles(directory + '/' + entry.name) : [directory + '/' + entry.name]));
  return nested.flat().filter(file => /\.(?:astro|tsx?|jsx?)$/.test(file));
}
const queue = [...await sourceFiles('src'), 'assets/favicon.svg', 'assets/site.css', 'assets/labs.css', 'assets/site-header.css', 'assets/locale.js', 'assets/scroll-fill.js', 'assets/labs/controller.js', 'assets/vendor/three/build/three.module.js', 'assets/vendor/three/LICENSE', 'assets/vendor/meshoptimizer/LICENSE.md', 'assets/about-legacy/vendor/LICENSE-three.txt', 'assets/about-legacy/notation-LICENSE.txt'];
const files = new Map();
const textExtensions = new Set(['.astro', '.tsx', '.ts', '.jsx', '.html', '.css', '.js', '.mjs', '.json', '.svg', '.gltf']);
const assetExtension = /\.(?:html|css|m?js|json|svg|png|jpe?g|webp|gif|avif|glb|gltf|bin|wasm|woff2?|ttf|mp3|wav|ogg|txt)(?:[?#].*)?$/i;

function resolveAsset(reference, from) {
  if (/^(?:https?:|data:|mailto:|tel:|#|\/\/)/i.test(reference) || reference.includes('${')) return null;
  const clean = reference.split(/[?#]/)[0];
  if (!clean) return null;
  const candidate = path.posix.normalize(clean.startsWith('/') ? clean.slice(1) : path.posix.join(path.posix.dirname(from), clean));
  if (!candidate.startsWith('assets/') || candidate.split('/').some(part => part.startsWith('.') || /^(?:AGENTS|CLAUDE|GEMINI)/i.test(part))) return null;
  return candidate;
}

while (queue.length) {
  const relative = queue.shift();
  if (files.has(relative)) continue;
  const absolute = path.join(root, relative);
  let content;
  try {
    const resolved = await realpath(absolute);
    if (path.relative(root, resolved).startsWith('..')) throw new Error(`Asset escapes project: ${relative}`);
    content = await readFile(resolved);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Missing public dependency: ${relative}`);
    if (error.code !== 'EISDIR') throw error;
    for (const entry of await readdir(absolute)) queue.push(`${relative.replace(/\/$/, '')}/${entry}`);
    continue;
  }
  files.set(relative, content);
  if (!textExtensions.has(path.extname(relative))) continue;
  const source = content.toString('utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const match of source.matchAll(/\/assets\/[\w./%\-]+/g)) {
    if (assetExtension.test(match[0])) queue.push(match[0].slice(1));
  }
  if (path.extname(relative) !== '.html') for (const match of source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g)) {
    const reference = match[2];
    if (reference.startsWith('three/addons/')) { queue.push(reference.replace('three/addons/', 'assets/vendor/three/examples/jsm/')); continue; }
    if (!reference.startsWith('/') && !reference.startsWith('./') && !reference.startsWith('../')) continue;
    if (reference.endsWith('/')) continue;
    if (!assetExtension.test(reference) && !reference.startsWith('/assets/')) continue;
    const dependency = resolveAsset(reference, relative);
    if (dependency) queue.push(dependency);
  }
  for (const match of source.matchAll(/url\(\s*["']?([^\s)"']+)/g)) {
    const dependency = resolveAsset(match[1], relative);
    if (dependency) queue.push(dependency);
  }
}

await rm(destination, { recursive: true, force: true });
for (const [relative, content] of files) {
  if (!relative.startsWith('assets/')) continue;
  const target = path.join(destination, relative);
  await mkdir(path.dirname(target), { recursive: true });
  if (relative.endsWith('/stillflow/index.html')) {
    await writeFile(target, content.toString('utf8').replace('</head>', '<meta name="robots" content="noindex, nofollow" /></head>'));
  } else await copyFile(path.join(root, relative), target);
}
await writeFile(path.join(root, '.astro', 'public-manifest.json'), JSON.stringify([...files.keys()].sort(), null, 2));
const notices = [];
for (const name of ['react', 'react-dom', 'scheduler', 'astro', '@astrojs/react', '@astrojs/react-renderer']) {
  const directory = path.join(root, 'node_modules', name);
  const license = (await readdir(directory)).find(file => /^license(?:\.(?:md|txt))?$/i.test(file));
  if (!license) throw new Error(`Missing runtime license for ${name}`);
  notices.push(`${name}\n${await readFile(path.join(directory, license), 'utf8')}`);
}
await writeFile(path.join(destination, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n\n---\n\n'));
console.log(`Staged ${[...files.keys()].filter(file => file.startsWith('assets/')).length} public assets from current source dependencies.`);
