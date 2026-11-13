// Runs every tests/*.test.mjs (one process each, with a timeout). Exits non-zero if any file fails.
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const filter = process.argv[2] || '';
const files = readdirSync('tests').filter((f) => f.endsWith('.test.mjs') && f.includes(filter)).sort();
let failed = 0;
for (const f of files) {
  const out = await new Promise((resolve) => {
    const p = spawn(process.execPath, [`tests/${f}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = ''; p.stdout.on('data', (d) => (buf += d)); p.stderr.on('data', (d) => (buf += d));
    const timer = setTimeout(() => { buf += '\nTIMEOUT'; p.kill('SIGKILL'); }, 60_000);
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, buf }); });
  });
  if (out.code === 0) console.log(`PASS  ${f}`); else { failed++; console.log(`FAIL  ${f}\n${out.buf}`); }
}
console.log(`\n${files.length - failed}/${files.length} test files passed`);
process.exit(failed ? 1 : 0);
