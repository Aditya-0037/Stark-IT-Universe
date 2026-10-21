import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Exposes which brand files and 3D models exist in /public so the app can
 * fall back to drawn placeholders (and to primitive 3D models) without
 * requesting files that are not there. Adding or removing a file in
 * public/brand or public/models triggers a full reload in dev.
 */
const VIRTUAL_ID = 'virtual:siu-assets';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

const toPosix = (p: string) => p.replace(/\\/g, '/');

function listFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
  } catch {
    return [];
  }
}

// Shown in the browser tab until public/brand/siu-app-icon.svg exists.
const PLACEHOLDER_FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#060A22"/><circle cx="32" cy="32" r="15" fill="#FFB52E"/><circle cx="12" cy="20" r="4" fill="#8B5CF6"/><circle cx="52" cy="16" r="4" fill="#06B6D4"/><circle cx="54" cy="44" r="4" fill="#EC4899"/><circle cx="32" cy="56" r="4" fill="#3B82F6"/><circle cx="10" cy="46" r="4" fill="#10B981"/></svg>`,
  );

function siuAssets(): Plugin {
  const root = process.cwd();
  const brandDir = path.join(root, 'public', 'brand');
  const modelsDir = path.join(root, 'public', 'models');

  return {
    name: 'siu-assets',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return [
        `export const brandFiles = ${JSON.stringify(listFiles(brandDir))};`,
        `export const modelFiles = ${JSON.stringify(listFiles(modelsDir))};`,
      ].join('\n');
    },
    transformIndexHtml(html) {
      const hasIcon = listFiles(brandDir).includes('siu-app-icon.svg');
      const href = hasIcon ? '/brand/siu-app-icon.svg' : PLACEHOLDER_FAVICON;
      return html.replace('<!--brand-favicon-->', `<link rel="icon" type="image/svg+xml" href="${href}" />`);
    },
    configureServer(server) {
      server.watcher.add([brandDir, modelsDir]);
      const watched = [toPosix(brandDir), toPosix(modelsDir)];
      const onChange = (file: string) => {
        const f = toPosix(file);
        if (!watched.some((dir) => f.startsWith(dir))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

export default defineConfig({
  plugins: [react(), siuAssets()],
  // Pre-bundle the lazily loaded 3D/scroll libraries so the dev server does
  // not re-optimise (and reload) the first time the 3D layer loads.
  optimizeDeps: {
    include: [
      'three',
      'three-stdlib',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      'postprocessing',
      'gsap',
      'gsap/ScrollTrigger',
      'lenis',
      'motion/react',
    ],
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
  },
});
