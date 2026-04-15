import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const rootDir = resolve(__dirname);

// Copy extension-only files (manifest, background, icons) to dist/
function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const src = join(rootDir, 'extension');
      const dst = join(rootDir, 'dist');

      for (const file of ['manifest.json', 'background.js']) {
        copyFileSync(join(src, file), join(dst, file));
      }

      mkdirSync(join(dst, 'icons'), { recursive: true });
      for (const file of readdirSync(join(src, 'icons'))) {
        copyFileSync(join(src, 'icons', file), join(dst, 'icons', file));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
