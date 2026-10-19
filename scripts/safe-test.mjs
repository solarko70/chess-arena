/**
 * Safe test runner watchdog (scripts/safe-test.mjs).
 *
 * Launches Vitest (or a custom script via --exec) as a child process,
 * polls memory usage of all spawned node.exe processes every 500 ms,
 * and kills the entire process tree (taskkill /T /F) if:
 *   - Any single process exceeds 2 GB (2048 MB)
 *   - Total memory across processes exceeds 3 GB (3072 MB)
 *   - Total execution time exceeds 120 seconds
 */
import { spawn, execFile, execFileSync } from 'node:child_process';
import path from 'node:path';

const SINGLE_PROCESS_LIMIT_MB = 2048; // 2 GB
const TOTAL_MEMORY_LIMIT_MB = 3072; // 3 GB
const TIMEOUT_SECONDS = 120;
const POLL_INTERVAL_MS = 500;

/**
 * Parse `tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH` output into
 * an array of { pid, mb }.
 */
function parseTasklistCsv(stdout) {
  const results = [];
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('"node.exe"')) continue;
    const parts = trimmed.split('","').map((s) => s.replace(/^"|"$/g, ''));
    if (parts.length < 5) continue;
    const pid = Number.parseInt(parts[1], 10);
    const kbDigits = parts[4].replace(/\D+/g, '');
    const kb = Number.parseInt(kbDigits, 10);
    if (!Number.isNaN(pid) && !Number.isNaN(kb)) {
      results.push({ pid, mb: kb / 1024 });
    }
  }
  return results;
}

function getCurrentNodeProcessesSync() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseTasklistCsv(out);
  } catch {
    return [];
  }
}

function killProcessTree(pid, extraPids = []) {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  } catch {
    // Process may have already exited
  }
  for (const extraPid of extraPids) {
    if (extraPid === process.pid || extraPid === pid) continue;
    try {
      execFileSync('taskkill', ['/PID', String(extraPid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } catch {
      // Ignore
    }
  }
}

const rawArgs = process.argv.slice(2);
let command = process.execPath;
let commandArgs = [];
let targetLabel = '';

if (rawArgs[0] === '--exec') {
  const scriptPath = rawArgs[1];
  if (!scriptPath) {
    console.error('[WATCHDOG] Usage: node scripts/safe-test.mjs --exec <script>');
    process.exit(2);
  }
  commandArgs = [scriptPath, ...rawArgs.slice(2)];
  targetLabel = scriptPath;
} else {
  const vitestPath = path.resolve(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
  const hasNoParallelism = rawArgs.some((a) => a.startsWith('--no-file-parallelism'));
  const hasTimeout = rawArgs.some((a) => a.startsWith('--testTimeout'));
  const hasExclude = rawArgs.some((a) => a.startsWith('--exclude'));

  const defaultFlags = ['run'];
  if (!hasExclude) {
    defaultFlags.push('--exclude', 'src/tests/*.slow.test.ts');
  }
  if (!hasNoParallelism) {
    defaultFlags.push('--no-file-parallelism');
  }
  if (!hasTimeout) {
    defaultFlags.push('--testTimeout=20000');
  }

  commandArgs = [vitestPath, ...defaultFlags, ...rawArgs];
  const fileArgs = rawArgs.filter((a) => !a.startsWith('-'));
  targetLabel = fileArgs.length > 0 ? fileArgs.join(', ') : 'полный набор тестов';
}

// Record pre-existing node PIDs (including this watchdog PID) so we only measure the spawned test tree
const baselinePids = new Set(getCurrentNodeProcessesSync().map((p) => p.pid));
baselinePids.add(process.pid);

let currentFile = targetLabel;
let peakSingleMb = 0;
let peakTotalMb = 0;
let killedByWatchdog = false;
let polling = false;
const startTime = Date.now();

const child = spawn(command, commandArgs, {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
});

function inspectOutputChunk(chunk) {
  const text = chunk.toString();
  // Match test file paths like src/tests/foo.test.ts in Vitest output
  const match = text.match(/(src[\\/]+tests[\\/]+[\w.-]+\.test\.ts)/);
  if (match) {
    currentFile = match[1].replace(/\\/g, '/');
  }
}

child.stdout.on('data', (chunk) => {
  inspectOutputChunk(chunk);
  process.stdout.write(chunk);
});

child.stderr.on('data', (chunk) => {
  inspectOutputChunk(chunk);
  process.stderr.write(chunk);
});

const timer = setInterval(() => {
  if (killedByWatchdog || polling) return;
  polling = true;

  const elapsedSec = (Date.now() - startTime) / 1000;

  execFile(
    'tasklist',
    ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV', '/NH'],
    { encoding: 'utf8' },
    (err, stdout) => {
      polling = false;
      if (killedByWatchdog) return;

      const allProcs = err ? [] : parseTasklistCsv(stdout);
      const treeProcs = allProcs.filter((p) => p.pid === child.pid || !baselinePids.has(p.pid));

      let maxProcMb = 0;
      let maxProcPid = child.pid;
      let sumMb = 0;

      for (const proc of treeProcs) {
        sumMb += proc.mb;
        if (proc.mb > maxProcMb) {
          maxProcMb = proc.mb;
          maxProcPid = proc.pid;
        }
      }

      if (maxProcMb > peakSingleMb) peakSingleMb = maxProcMb;
      if (sumMb > peakTotalMb) peakTotalMb = sumMb;

      let violationReason = null;
      if (maxProcMb > SINGLE_PROCESS_LIMIT_MB) {
        violationReason = `превышен лимит памяти на один процесс (${maxProcMb.toFixed(0)} МБ > ${SINGLE_PROCESS_LIMIT_MB} МБ, PID ${maxProcPid})`;
      } else if (sumMb > TOTAL_MEMORY_LIMIT_MB) {
        violationReason = `превышен суммарный лимит памяти (${sumMb.toFixed(0)} МБ > ${TOTAL_MEMORY_LIMIT_MB} МБ, процессов: ${treeProcs.length})`;
      } else if (elapsedSec > TIMEOUT_SECONDS) {
        violationReason = `превышен лимит общего времени выполнения (${elapsedSec.toFixed(1)} с > ${TIMEOUT_SECONDS} с)`;
      }

      if (violationReason) {
        killedByWatchdog = true;
        clearInterval(timer);
        killProcessTree(
          child.pid,
          treeProcs.map((p) => p.pid),
        );
        console.error(
          `\n[WATCHDOG] АВАРИЙНАЯ ОСТАНОВКА!\n` +
            `  Причина: ${violationReason}\n` +
            `  Текущий файл/цель: ${currentFile}\n` +
            `  Память: макс. процесс = ${maxProcMb.toFixed(0)} МБ (пик ${peakSingleMb.toFixed(0)} МБ), суммарно = ${sumMb.toFixed(0)} МБ (пик ${peakTotalMb.toFixed(0)} МБ)\n` +
            `  Время: ${elapsedSec.toFixed(1)} с\n`,
        );
        process.exit(1);
      }
    },
  );
}, POLL_INTERVAL_MS);

child.on('close', (code) => {
  if (killedByWatchdog) return;
  clearInterval(timer);
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `\n[WATCHDOG] Прогон завершён (${currentFile}) | Время: ${elapsedSec} с | Пик памяти: макс. процесс = ${peakSingleMb.toFixed(0)} МБ, суммарно = ${peakTotalMb.toFixed(0)} МБ`,
  );
  process.exit(code ?? 1);
});

