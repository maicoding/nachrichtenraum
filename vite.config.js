import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function injectV2Precache() {
  return {
    name: 'inject-v2-precache',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const v2Output = resolve(projectRoot, 'dist/v2');
      const vendorOutput = resolve(projectRoot, 'dist/vendor');
      await mkdir(v2Output, { recursive: true });
      await mkdir(vendorOutput, { recursive: true });
      await Promise.all([
        copyFile(resolve(projectRoot, 'v2/icon.svg'), resolve(v2Output, 'icon.svg')),
        copyFile(resolve(projectRoot, 'v2/manifest.webmanifest'), resolve(v2Output, 'manifest.webmanifest')),
        copyFile(resolve(projectRoot, 'v2/sw.js'), resolve(v2Output, 'sw.js')),
        copyFile(resolve(projectRoot, 'vendor/AFRAME-LICENSE.txt'), resolve(vendorOutput, 'AFRAME-LICENSE.txt')),
        copyFile(resolve(projectRoot, 'vendor/aframe-v1.8.0.min.js'), resolve(vendorOutput, 'aframe-v1.8.0.min.js'))
      ]);
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
