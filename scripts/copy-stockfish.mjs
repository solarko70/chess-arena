/**
 * Copies the single-threaded lite Stockfish build (.js and .wasm) from
 * node_modules/stockfish/bin into public/stockfish/ by matching the mask
 * `stockfish-*-lite-single.*` without hardcoding a version number.
 * Also writes `manifest.json` with the discovered filenames so browser code
 * can load the exact versioned file dynamically.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const binDir = path.join(rootDir, 'node_modules', 'stockfish', 'bin');
const targetDir = path.join(rootDir, 'public', 'stockfish');

function copyStockfish() {
  if (!fs.existsSync(binDir)) {
    console.warn('[copy-stockfish] node_modules/stockfish/bin not found; skipping.');
    return;
  }

  const entries = fs.readdirSync(binDir);
  const jsFile = entries.find((f) => /^stockfish-.*-lite-single\.js$/.test(f));
  const wasmFile = entries.find((f) => /^stockfish-.*-lite-single\.wasm$/.test(f));

  if (!jsFile || !wasmFile) {
    console.warn('[copy-stockfish] stockfish-*-lite-single.* not found in node_modules/stockfish/bin; skipping.');
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  for (const existing of fs.readdirSync(targetDir)) {
    fs.rmSync(path.join(targetDir, existing), { force: true });
  }

  const srcJs = path.join(binDir, jsFile);
  const srcWasm = path.join(binDir, wasmFile);

  fs.copyFileSync(srcJs, path.join(targetDir, jsFile));
  fs.copyFileSync(srcWasm, path.join(targetDir, wasmFile));
  fs.writeFileSync(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify({ js: jsFile, wasm: wasmFile }, null, 2) + '\n',
    'utf-8',
  );
}

copyStockfish();
