import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(absolute));
    else output.push(absolute);
  }
  return output;
}
const files = await walk(root);
const forbidden = /(?:^|\/)(?:\.git|\.agents|\.cursor|planning|references|experiments|tests|tools|node_modules)(?:\/|$)|(?:^|\/)(?:AGENTS(?:\.override)?\.md|CLAUDE\.md|GEMINI\.md|SKILL\.md|.*\.patch|.*\.bundle)$/i;
for (const file of files) assert.ok(!forbidden.test(path.relative(root, file).replaceAll('\\', '/')), `Private or development file in build: ${file}`);

const pages = files.filter(file => file.endsWith('.html'));
assert.equal(pages.length, 13, 'Root, ten localized pages and two review pages must remain available.');
for (const page of pages) {
  const html = await readFile(page, 'utf8');
  if (page.includes(`${path.sep}stillflow${path.sep}`)) assert.match(html, /name="robots" content="noindex, nofollow"/);
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)(?:#[^"]*)?"/g)) {
    const url = new URL(match[1], `http://local/${path.relative(root, page).replaceAll('\\', '/')}`);
    if (url.origin !== 'http://local') continue;
    const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
    const target = path.join(root, relative, url.pathname.endsWith('/') ? 'index.html' : '');
    assert.ok((await stat(target)).isFile(), `Broken resource ${match[1]} in ${page}`);
  }
}
console.log(`Verified ${pages.length} page routes, local HTML links and ${files.length} public files; no private/development paths.`);
