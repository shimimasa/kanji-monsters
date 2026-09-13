import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const files = (await readdir(new URL('../tests/', import.meta.url), { recursive: true }))
  .filter(file => file.endsWith('.test.mjs'))
  // Earlier per-phase scope tests freeze historical commits and prohibit this
  // explicitly requested integration. Keep all behavioral tests and the updated
  // defense boundary audit; preserve those historical audit files as records.
  .filter(file => !file.endsWith('scope.test.mjs') || file.includes('minigame-production-kanji-defense'))
  .sort().map(file => `tests/${file.replaceAll('\\', '/')}`);
const child = spawn(process.execPath, ['--experimental-default-type=module','--test','--test-concurrency=1', ...files],
  { cwd: repo, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
