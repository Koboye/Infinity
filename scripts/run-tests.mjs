// Runs every tests/*.test.mjs in parallel (bounded), with a per-file timeout. Exits non-zero if any file fails.
// Usage: node scripts/run-tests.mjs [filter]   (filter = substring of the file name)
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

const filter = process.argv[2] || '';
const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS) || 240_000;
const files = readdirSync('tests').filter((f) => f.endsWith('.test.mjs') && f.includes(filter)).sort();
const limit = Math.max(2, Math.min(8, availableParallelism()));
const results = [];
let next = 0;

function run(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [`tests/${file}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => { out += `\nTIMEOUT after ${TIMEOUT_MS} ms`; p.kill('SIGKILL'); }, TIMEOUT_MS);
    p.on('close', (code) => { clearTimeout(timer); resolve({ file, ok: code === 0, ms: Date.now() - t0, out }); });
  });
}
async function worker() {
  while (next < files.length) {
    const r = await run(files[next++]);
    results.push(r);
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.file}  (${(r.ms / 1000).toFixed(1)}s)`);
    if (!r.ok) console.log(r.out.split('\n').slice(-15).map((l) => '    ' + l).join('\n'));
  }
}
await Promise.all(Array.from({ length: limit }, worker));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} test files passed`);
process.exit(failed.length ? 1 : 0);
