/**
 * Copies the single-threaded lite Stockfish build (.js and .wasm) from
 * node_modules/stockfish/bin into public/stockfish/ under both the original
 * versioned filenames and fixed aliases:
 * - stockfish-lite-single.js / stockfish-lite-single.wasm
 * - stockfish-18-lite-single.js / stockfish-18-lite-single.wasm
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
    console.warn('[copy-stockfish] lite-single files not found in node_modules/stockfish/bin; skipping.');
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  // Remove any stale files so public/stockfish contains only the lite-single pair
  for (const existing of fs.readdirSync(targetDir)) {
    fs.rmSync(path.join(targetDir, existing), { force: true });
  }

  const srcJs = path.join(binDir, jsFile);
  const srcWasm = path.join(binDir, wasmFile);

  fs.copyFileSync(srcJs, path.join(targetDir, 'stockfish-18-lite-single.js'));
  fs.copyFileSync(srcWasm, path.join(targetDir, 'stockfish-18-lite-single.wasm'));
}

copyStockfish();
