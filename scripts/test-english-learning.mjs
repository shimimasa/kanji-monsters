import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(file);
    if (!entry.name.endsWith('.test.mjs')) return [];
    // Historical checkpoint scopes remain intact. Defense's current scope still applies.
    if (entry.name === 'scope.test.mjs' && path.basename(directory) !== 'minigame-production-kanji-defense') return [];
    return [file];
  });
}
// The content-only freeze expected English Core/View and shell byte equality.
// This feature deliberately changes them; retain that historical test unchanged,
// and run the new English-review boundary and behavior tests instead.
const result = spawnSync(process.execPath, ['--experimental-default-type=module', '--test', '--test-concurrency=1',
  '--test-skip-pattern=all eight Core/View files and gameplay/growth/logger boundaries unchanged',
  ...collect('tests')], { stdio: 'inherit', windowsHide: true });
process.exit(result.status ?? 1);
