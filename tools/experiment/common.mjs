import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const BASELINE = '2a521dd5aa747314b25e761d976bd4f880cd58c3';
export const TAG = 'refs/tags/yomitabi-2d-stable-2026-09';
export const CORE = ['saveData.js', 'saveValidation.js', 'kanjiIdMigration.js', 'saveProjection.js', 'storageTransaction.js'];
export const hash = value => createHash('sha256').update(value).digest('hex');
export const canonical = entries => JSON.stringify(Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, 'en'))));
export function git(root, ...args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim(); }
export function args() {
  const values = process.argv.slice(2);
  if (values.length % 2) throw Error('Expected --name value pairs');
  return Object.fromEntries(Array.from({ length: values.length / 2 }, (_, i) => [values[2*i].replace(/^--/, ''), values[2*i+1]]));
}
export async function baselineCore(root) {
  if (git(root, 'rev-parse', 'HEAD') !== BASELINE || git(root, 'rev-parse', `${TAG}^{}`) !== BASELINE) throw Error('STOP baseline mismatch');
  if (git(root, 'diff', '--name-only', BASELINE, '--', 'src', 'package.json', 'package-lock.json', 'public', 'index.html', 'style.css', 'vite.config.js')) throw Error('STOP product changes');
  return Object.fromEntries(await Promise.all(CORE.map(async name => {
    const filename = `src/core/${name}`;
    return [filename, { gitBlob: git(root, 'rev-parse', `${BASELINE}:${filename}`), sha256: hash(await readFile(path.join(root, filename))) }];
  })));
}
export class MemoryStorage {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); }
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(k) { return this.data.get(String(k)) ?? null; }
  setItem(k,v) { this.data.set(String(k), String(v)); }
  removeItem(k) { this.data.delete(String(k)); }
}
export async function inside(root, relative) {
  const base = await realpath(root);
  const target = await realpath(path.resolve(base, relative));
  const rel = path.relative(base, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Outside serving root');
  return target;
}
