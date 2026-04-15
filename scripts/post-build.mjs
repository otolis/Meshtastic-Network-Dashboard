#!/usr/bin/env node
/**
 * Post-build step. Copies dist/index.html to dist/404.html as a defensive
 * SPA fallback for GitHub Pages. HashRouter doesn't strictly need it, but
 * it guards against stray BrowserRouter-style URLs landing here.
 */
import { copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';

async function main() {
  try {
    await stat(join(DIST, 'index.html'));
  } catch {
    console.error(`[post-build] ${DIST}/index.html not found — did vite build fail?`);
    process.exit(1);
  }
  await copyFile(join(DIST, 'index.html'), join(DIST, '404.html'));
  console.log(`[post-build] wrote ${DIST}/404.html (SPA fallback)`);
}

main().catch((err) => {
  console.error('[post-build] failed:', err);
  process.exit(1);
});
