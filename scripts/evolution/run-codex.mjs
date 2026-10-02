// Asks the Codex CLI (codex exec, its image generation tool) for each target's evolved picture.
// One Codex run per Gotomon, in its own folder under the given output folder, with the original picture
// attached. Codex only writes <id>_evo.png there; nothing in the repo is touched.
// usage: node --experimental-default-type=module scripts/evolution/run-codex.mjs <outDir> [--dry] [id ...]
//   --dry: write each prompt.txt and show the attached picture, without calling Codex.
import { readFileSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const [outDir, ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry'), only = rest.filter(arg => arg !== '--dry');
if (!outDir) throw new Error('usage: run-codex.mjs <outDir> [id ...]');
const data = file => JSON.parse(readFileSync(`public/data/${file}`, 'utf8')).flat(Infinity).filter(m => m?.id);
const monsters = new Map([...data('enemies_proto.json'), ...data('enemy_world.json')].map(m => [m.id, m]));
// The picture is found by its file name in any folder of full/ (the world Gotomon's grade does not name their folder).
const FULL = 'public/assets/images/monsters/full';
const pictureOf = id => readdirSync(FULL).map(folder => resolve(FULL, folder, `${id}.webp`)).find(existsSync);
const template = readFileSync('scripts/evolution/prompt.tpl.txt', 'utf8');
const targets = JSON.parse(readFileSync('scripts/evolution/targets.json', 'utf8')).filter(t => !only.length || only.includes(t.id));

for (const target of targets) {
  const monster = monsters.get(target.id);
  if (!monster) throw new Error(`unknown ${target.id}`);
  const image = pictureOf(target.id);
  if (!image) throw new Error(`no picture for ${target.id}`);
  const dir = resolve(join(outDir, target.id)); mkdirSync(dir, { recursive: true });
  if (existsSync(join(dir, `${target.id}_evo.png`))) { console.log(`${target.id}: already there`); continue; }
  const prompt = template.replaceAll('{name}', monster.name).replaceAll('{desc}', monster.desc ?? '').replaceAll('{body}', target.body).replaceAll('{id}', target.id);
  writeFileSync(join(dir, 'prompt.txt'), prompt);
  if (dry) { console.log(`${target.id} ${monster.name}: ${image}`); continue; }
  const started = Date.now();
  const run = spawnSync('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', dir, '-i', image, '-'],
    { input: prompt, encoding: 'utf8', shell: true, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(dir, 'codex.log'), `${run.stdout ?? ''}\n--- stderr ---\n${run.stderr ?? ''}`);
  const ok = existsSync(join(dir, `${target.id}_evo.png`));
  console.log(`${target.id}: ${ok ? 'saved' : 'NOT saved'} (exit ${run.status}, ${Math.round((Date.now() - started) / 1000)}s)`);
}
