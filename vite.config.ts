import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'fs';
import { join, resolve } from 'path';

const rootDir = resolve(__dirname);

function devReloadPlugin() {
  return {
    name: 'dev-reload',
    closeBundle() {
      writeFileSync(join(rootDir, 'extension', '.version'), String(Date.now()));
    },
  };
}

export default defineConfig({
  plugins: [react(), devReloadPlugin()],
  build: {
    outDir: 'extension',
    emptyOutDir: false,
  },
});
