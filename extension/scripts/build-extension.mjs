import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const EXT_DIR = path.resolve(ROOT_DIR, 'extension');
const OUT_DIR = path.resolve(ROOT_DIR, 'dist-extension');

async function buildExtension() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Service Worker MV3 (type: "module")
  await build({
    entryPoints: [path.join(EXT_DIR, 'src', 'background.ts')],
    outdir: OUT_DIR,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome114', 'edge114'],
    sourcemap: false,
    minify: false,
  });

  // Content scripts e popup (scripts clássicos sem export top-level)
  await build({
    entryPoints: [
      path.join(EXT_DIR, 'src', 'appBridge.ts'),
      path.join(EXT_DIR, 'src', 'sroContentScript.ts'),
      path.join(EXT_DIR, 'src', 'popup.ts'),
    ],
    outdir: OUT_DIR,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome114', 'edge114'],
    sourcemap: false,
    minify: false,
  });

  fs.copyFileSync(
    path.join(EXT_DIR, 'manifest.json'),
    path.join(OUT_DIR, 'manifest.json')
  );
  fs.copyFileSync(
    path.join(EXT_DIR, 'src', 'popup.html'),
    path.join(OUT_DIR, 'popup.html')
  );

  console.log(`Extensão piloto compilada com sucesso em: ${OUT_DIR}`);
}

buildExtension().catch((err) => {
  console.error('Erro ao compilar extensão piloto:', err);
  process.exit(1);
});
