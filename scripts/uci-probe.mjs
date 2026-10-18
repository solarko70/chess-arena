#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Trampoline so `node scripts/uci-probe.mjs` works directly in environments without native TS execution
if (!process.env.__PROBE_TSX__) {
  const isWin = process.platform === 'win32';
  const npxCmd = isWin ? 'npx.cmd' : 'npx';
  const scriptPath = fileURLToPath(import.meta.url);
  const result = spawnSync(npxCmd, ['tsx', scriptPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, __PROBE_TSX__: '1' },
  });
  process.exit(result.status ?? 0);
}

const req = createRequire(import.meta.url);
const findEngine = req('stockfish/scripts/findEngine.js');
const engineJsPath = findEngine('lite-single');

const MORPHY_SAN_MOVES = [
  'e4', 'e5',
  'Nf3', 'd6',
  'd4', 'Bg4',
  'dxe5', 'Bxf3',
  'Qxf3', 'dxe5',
  'Bc4', 'Nf6',
  'Qb3', 'Qe7',
  'Nc3', 'c6',
  'Bg5', 'b5',
  'Nxb5', 'cxb5',
  'Bxb5+', 'Nbd7',
  'O-O-O', 'Rd8',
  'Rxd7', 'Rxd7',
  'Rd1', 'Qe6',
  'Bxd7+', 'Nxd7',
  'Qb8+', 'Nxb8',
  'Rd8#',
];

function runProbe(fen, depths) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [engineJsPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutBuf = '';
    const lines = [];

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf-8');
      const parts = stdoutBuf.split(/\r?\n/);
      stdoutBuf = parts.pop() ?? '';
      for (const p of parts) {
        if (p.trim().length > 0) {
          lines.push(p);
          onLine(p);
        }
      }
    });

    let currentResolver = null;
    let targetPredicate = null;

    function waitFor(predicate) {
      return new Promise((res) => {
        targetPredicate = predicate;
        currentResolver = res;
      });
    }

    function onLine(line) {
      if (targetPredicate && targetPredicate(line)) {
        targetPredicate = null;
        const res = currentResolver;
        currentResolver = null;
        res(line);
      }
    }

    function send(cmd) {
      child.stdin.write(`${cmd}\n`);
    }

    async function execute() {
      send('uci');
      await waitFor((l) => l.trim() === 'uciok');

      for (const d of depths) {
        console.log(`\n==================================================`);
        console.log(`FEN: ${fen}`);
        console.log(`COMMAND: go depth ${d} (after ucinewgame, MultiPV 2)`);
        console.log(`==================================================`);
        send('ucinewgame');
        send('setoption name MultiPV value 2');
        send('isready');
        await waitFor((l) => l.trim() === 'readyok');
        send(`position fen ${fen}`);
        const depthLines = [];
        const prevOnLine = onLine;
        onLine = (l) => {
          depthLines.push(l);
          prevOnLine(l);
        };
        send(`go depth ${d}`);
        await waitFor((l) => l.startsWith('bestmove'));
        for (const dl of depthLines) {
          console.log(dl);
        }
      }

      send('quit');
      child.kill();
      resolve();
    }

    execute().catch(reject);
  });
}

async function main() {
  const { classicalRuleSet, sanToMove, applyMove, serializeFEN } = await import('../src/core/index.ts');

  let state = classicalRuleSet.getInitialState();
  const states = [state];
  for (const san of MORPHY_SAN_MOVES) {
    const move = sanToMove(state, san);
    if (!move) throw new Error(`Cannot parse ${san}`);
    state = applyMove(state, move);
    states.push(state);
  }

  // Ply 29: after 15.Bxd7+ (states[29], turn is Black)
  const stateAfter29 = states[29];
  const fenAfter29 = serializeFEN(stateAfter29);

  // Ply 30: after 15...Nxd7 (states[30], turn is White)
  const stateAfter30 = states[30];
  const fenAfter30 = serializeFEN(stateAfter30);

  console.log('FEN after 15.Bxd7+ (ply 29):', fenAfter29);
  console.log('FEN after 15...Nxd7 (ply 30):', fenAfter30);

  const depths = [8, 10, 12, 14, 18];
  console.log('\n>>> PROBING POSITION AFTER 15.Bxd7+ <<<');
  await runProbe(fenAfter29, depths);

  console.log('\n\n>>> PROBING POSITION AFTER 15...Nxd7 <<<');
  await runProbe(fenAfter30, depths);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

