import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, readFile } from 'node:fs/promises';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function injectV2Precache() {
  return {
    name: 'inject-v2-precache',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const indexPath = resolve(projectRoot, 'dist/v2/index.html');
      const workerPath = resolve(projectRoot, 'dist/v2/sw.js');
      const html = await readFile(indexPath, 'utf8');
      const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((url) => url.startsWith('/nachrichtenraum/'));
      const worker = await readFile(workerPath, 'utf8');
      await writeFile(
        workerPath,
        worker.replace('self.__V2_BUILD_ASSETS__ || []', JSON.stringify([...new Set(urls)]))
      );
    }
  };
}

export default defineConfig({
  plugins: [injectV2Precache()],
  base: '/nachrichtenraum/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),
        v2: resolve(projectRoot, 'v2/index.html')
      }
    }
  }
});
