/**
 * Safe test runner watchdog (scripts/safe-test.mjs).
 *
 * Launches Vitest (or a custom script via --exec) as a child process,
 * monitors memory usage of ONLY the spawned process tree (using ParentProcessId)
 * every 500 ms via PowerShell, and kills the entire process tree (taskkill /T /F) if:
 *   - Any single process in the tree exceeds 2 GB (2048 MB)
 *   - Total memory across the process tree exceeds 3 GB (3072 MB)
 *   - Total execution time exceeds 120 seconds
 */
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';

const SINGLE_PROCESS_LIMIT_MB = 2048; // 2 GB
const TOTAL_MEMORY_LIMIT_MB = 3072; // 3 GB
const TIMEOUT_SECONDS = 180;
const POLL_INTERVAL_MS = 500;

/**
 * Filter an array of { pid, ppid, mb } objects down to only those processes
 * that belong to the process tree rooted at `rootPid` (direct or indirect descendants).
 */
export function filterProcessTree(allProcs, rootPid) {
  const treePids = new Set([rootPid]);
  let added = true;
  while (added) {
    added = false;
    for (const p of allProcs) {
      if (!treePids.has(p.pid) && treePids.has(p.ppid)) {
        treePids.add(p.pid);
        added = true;
      }
    }
  }
  return allProcs.filter((p) => treePids.has(p.pid));
}

/**
 * Parse PowerShell JSON output of process objects into an array of { pid, ppid, mb }.
 */
export function parseProcessJson(raw) {
  if (!raw || !raw.trim()) return [];
  try {
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : [data];
    return list
      .map((item) => ({
        pid: Number(item.ProcessId),
        ppid: Number(item.ParentProcessId),
        mb: Number(item.WorkingSetSize) / (1024 * 1024),
      }))
      .filter((p) => !Number.isNaN(p.pid) && !Number.isNaN(p.ppid) && !Number.isNaN(p.mb));
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

let currentFile = targetLabel;
let peakSingleMb = 0;
let peakTotalMb = 0;
let killedByWatchdog = false;
const startTime = Date.now();

const child = spawn(command, commandArgs, {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
});

function inspectOutputChunk(chunk) {
  const text = chunk.toString();
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

function handleViolation(reason, maxProcMb = 0, maxProcPid = child.pid, sumMb = 0, treePids = []) {
  if (killedByWatchdog) return;
  killedByWatchdog = true;
  cleanupWatchdog();

  killProcessTree(child.pid, treePids);

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(
    `\n[WATCHDOG] АВАРИЙНАЯ ОСТАНОВКА!\n` +
      `  Причина: ${reason}\n` +
      `  Текущий файл/цель: ${currentFile}\n` +
      `  Память: макс. процесс = ${maxProcMb.toFixed(0)} МБ (пик ${peakSingleMb.toFixed(0)} МБ), суммарно = ${sumMb.toFixed(0)} МБ (пик ${peakTotalMb.toFixed(0)} МБ)\n` +
      `  Время: ${elapsedSec} с\n`,
  );
  process.exit(1);
}

// Background PowerShell process querying node.exe process stats every 500ms
const psQueryScript = `
$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId,ParentProcessId,WorkingSetSize)
  if ($procs.Count -gt 0) {
    ConvertTo-Json -Compress -InputObject $procs
  } else {
    Write-Output "[]"
  }
  Start-Sleep -Milliseconds ${POLL_INTERVAL_MS}
}
`;

const psMonitor = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psQueryScript], {
  stdio: ['ignore', 'pipe', 'ignore'],
});

let psStdoutBuffer = '';

function processSnapshotLine(line) {
  const trimmed = line.trim();
  if (!trimmed || killedByWatchdog) return;

  const allNodeProcesses = parseProcessJson(trimmed);
  // Strictly filter only processes in the spawned test process tree
  const treeProcs = filterProcessTree(allNodeProcesses, child.pid);

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

  if (maxProcMb > SINGLE_PROCESS_LIMIT_MB) {
    handleViolation(
      `превышен лимит памяти на один процесс (${maxProcMb.toFixed(0)} МБ > ${SINGLE_PROCESS_LIMIT_MB} МБ, PID ${maxProcPid})`,
      maxProcMb,
      maxProcPid,
      sumMb,
      treeProcs.map((p) => p.pid),
    );
  } else if (sumMb > TOTAL_MEMORY_LIMIT_MB) {
    handleViolation(
      `превышен суммарный лимит памяти (${sumMb.toFixed(0)} МБ > ${TOTAL_MEMORY_LIMIT_MB} МБ, процессов в дереве: ${treeProcs.length})`,
      maxProcMb,
      maxProcPid,
      sumMb,
      treeProcs.map((p) => p.pid),
    );
  }
}

psMonitor.stdout.on('data', (chunk) => {
  psStdoutBuffer += chunk.toString();
  const lines = psStdoutBuffer.split(/\r?\n/);
  psStdoutBuffer = lines.pop() ?? '';
  for (const line of lines) {
    processSnapshotLine(line);
  }
});

// Periodic check for wall-clock execution timeout
const timeoutTimer = setInterval(() => {
  if (killedByWatchdog) return;
  const elapsedSec = (Date.now() - startTime) / 1000;
  if (elapsedSec > TIMEOUT_SECONDS) {
    handleViolation(`превышен лимит общего времени выполнения (${elapsedSec.toFixed(1)} с > ${TIMEOUT_SECONDS} с)`);
  }
}, POLL_INTERVAL_MS);

function cleanupWatchdog() {
  clearInterval(timeoutTimer);
  try {
    psMonitor.kill();
  } catch {
    // Ignore
  }
}

child.on('close', (code) => {
  if (killedByWatchdog) return;
  cleanupWatchdog();
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `\n[WATCHDOG] Прогон завершён (${currentFile}) | Время: ${elapsedSec} с | Пик памяти: макс. процесс = ${peakSingleMb.toFixed(0)} МБ, суммарно = ${peakTotalMb.toFixed(0)} МБ`,
  );
  process.exit(code ?? 1);
});
