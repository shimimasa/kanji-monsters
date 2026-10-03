// Asks the Codex CLI (codex exec, its image generation tool) for each target's evolved picture.
// One Codex run per Gotomon, in its own folder under the given output folder, with the original picture
// attached; up to --jobs runs at once (default 4). Codex only writes <id>_evo.png there; nothing in the
// repo is touched. A target whose picture is already there is skipped, so a round can be resumed, and a
// new round goes into a new output folder.
// usage: node --experimental-default-type=module scripts/evolution/run-codex.mjs <outDir> [--dry] [--jobs=N] [id ...]
//   --dry: write each prompt.txt and show the attached picture, without calling Codex.
import { readFileSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const [outDir, ...rest] = process.argv.slice(2);
if (!outDir) throw new Error('usage: run-codex.mjs <outDir> [--dry] [--jobs=N] [id ...]');
const dry = rest.includes('--dry'), jobs = Math.max(1, Number(rest.find(arg => arg.startsWith('--jobs='))?.slice(7)) || 4);
const only = rest.filter(arg => !arg.startsWith('--'));
const data = file => JSON.parse(readFileSync(`public/data/${file}`, 'utf8')).flat(Infinity).filter(m => m?.id);
const monsters = new Map([...data('enemies_proto.json'), ...data('enemies_legend.json')].map(m => [m.id, m]));
// The picture is found by its file name in any folder of full/ (the world Gotomon's grade does not name their folder).
const FULL = 'public/assets/images/monsters/full';
const pictureOf = id => readdirSync(FULL).map(folder => resolve(FULL, folder, `${id}.webp`)).find(existsSync);
// The direction each evolution leans to (ユーザーと決めた：1ぴき1つ、性格に合わせて。ぶきみは ちょっとだけ).
const STYLES = {
  cute: 'かわいさを 強める。まるみ・大きめの目・やわらかい色・小さな なかまや リボン・花・ほしの かざりなど。見て にっこりする すがた。',
  cool: 'かっこよさを 強める。きりっとした 立ちすがた・よろいや 角・光る もよう・マントなど。強くて たのもしいが、目つきは おだやか。',
  eerie: 'ちょっと ぶきみに する（こわすぎない）。夜・霧・おばけの ような うすい光・あやしい 色の もよう・ただよう 影など。ふしぎで 少し ぞくっと するが、顔は おだやか。',
  // 実在の人物・神さま・仏像・文化財・民族の衣装が もとの子（ユーザーの決定：子どもが その土地の 歴史や 名所を 知るための 教育ゲームなので 作る）。
  noble: 'りっぱで かっこよく する。この キャラクターは 実在の 人物・神話の 神さま・仏像・文化財・民族の 衣装が もとなので、敬意を もって えがく。悪者・こわい顔・ふざけた すがた・あやしい 色には しない。顔は おだやかで 堂々と。服装・文様・建物の 形は 元の絵の 特ちょうを ていねいに のこし、光・かざり・堂々とした ポーズで 成長を 表す。',
};
const template = readFileSync('scripts/evolution/prompt.tpl.txt', 'utf8');
const targets = JSON.parse(readFileSync('scripts/evolution/targets.json', 'utf8')).filter(t => !only.length || only.includes(t.id));

function prepare(target) {
  const monster = monsters.get(target.id);
  if (!monster) throw new Error(`unknown ${target.id}`);
  if (!STYLES[target.style]) throw new Error(`${target.id}: style must be one of ${Object.keys(STYLES)}`);
  const image = pictureOf(target.id);
  if (!image) throw new Error(`no picture for ${target.id}`);
  const dir = resolve(join(outDir, target.id)); mkdirSync(dir, { recursive: true });
  const prompt = template.replaceAll('{name}', monster.name).replaceAll('{desc}', monster.desc ?? '')
    .replaceAll('{style}', STYLES[target.style]).replaceAll('{id}', target.id);
  writeFileSync(join(dir, 'prompt.txt'), prompt);
  return { ...target, monster, image, dir, prompt, done: existsSync(join(dir, `${target.id}_evo.png`)) };
}

function run(task) {
  return new Promise(done => {
    const started = Date.now(), child = spawn('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', task.dir, '-i', task.image, '-'], { shell: true });
    let log = '';
    child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
    const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);
    child.on('close', code => {
      clearTimeout(timer); writeFileSync(join(task.dir, 'codex.log'), log);
      const ok = existsSync(join(task.dir, `${task.id}_evo.png`));
      console.log(`${task.id} (${task.style}): ${ok ? 'saved' : 'NOT saved'} (exit ${code}, ${Math.round((Date.now() - started) / 1000)}s)`);
      done();
    });
    child.stdin.end(task.prompt);
  });
}

const tasks = targets.map(prepare);
if (dry) { for (const task of tasks) console.log(`${task.id} ${task.monster.name} [${task.style}]: ${task.image}`); process.exit(0); }
const queue = tasks.filter(task => { if (task.done) console.log(`${task.id}: already there`); return !task.done; });
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));
