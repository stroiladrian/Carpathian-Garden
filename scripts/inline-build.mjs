// Inlines dist/ JS + CSS into a single self-contained HTML file (dist-single/index.html).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));
for (const f of assets) {
  const body = readFileSync(join(dist, 'assets', f), 'utf8');
  if (f.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]+href="\\./assets/${f}"[^>]*>`), () => `<style>${body}</style>`);
  } else if (f.endsWith('.js')) {
    html = html.replace(new RegExp(`<script[^>]+src="\\./assets/${f}"[^>]*></script>`), () => `<script type="module">${body.replace(/<\/script/g, '<\\/script')}</script>`);
  }
}
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/index.html', html);
console.log(`dist-single/index.html — ${(html.length / 1024).toFixed(1)} KB`);
