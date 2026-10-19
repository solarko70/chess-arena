/**
 * Intentional memory-allocating fixture to verify that scripts/safe-test.mjs
 * detects processes exceeding the 2 GB limit and kills the process tree within a couple of seconds.
 * Located in scripts/test-fixtures (never run by npm test).
 */
const chunks = [];
console.log('[memory-hog] Starting intentional memory allocation loop...');

setInterval(() => {
  // Allocate 256 MB and touch pages so OS commits physical working set
  const buf = Buffer.alloc(256 * 1024 * 1024, 0xaa);
  chunks.push(buf);
  const rssMb = (process.memoryUsage().rss / (1024 * 1024)).toFixed(0);
  console.log(`[memory-hog] Allocated ${chunks.length * 256} MB (RSS: ${rssMb} MB)`);
}, 150);

