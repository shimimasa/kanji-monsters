import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function spawnPortable(command, args, options) {
  if (process.platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(command)) {
    return spawn(command, args, options);
  }
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  const line = [quote(command), ...args.map(quote)].join(' ');
  return spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', line], options);
}

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function addResult(result, check) {
  result.checks.push({ ...check, recordedAt: new Date().toISOString() });
  return check;
}

export async function createRunDirectory(repoRoot) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const directory = path.join(repoRoot, 'artifacts', 'kanji-defense', 'browser-certification', `run-${stamp}`);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

export async function runLogged(command, args, { cwd, logPath, env = process.env } = {}) {
  const lines = [];
  const child = spawnPortable(command, args, { cwd, env, windowsHide: true, shell: false });
  child.stdout.on('data', chunk => lines.push(chunk.toString()));
  child.stderr.on('data', chunk => lines.push(chunk.toString()));
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  await fs.writeFile(logPath, lines.join(''), 'utf8');
  if (exitCode !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${exitCode}`);
  return { exitCode, output: lines.join('') };
}

export function spawnLogged(command, args, { cwd, logPath, env = process.env } = {}) {
  const lines = [];
  const child = spawnPortable(command, args, { cwd, env, windowsHide: true, shell: false });
  child.stdout.on('data', chunk => lines.push(chunk.toString()));
  child.stderr.on('data', chunk => lines.push(chunk.toString()));
  const flush = async () => fs.writeFile(logPath, lines.join(''), 'utf8');
  return { child, lines, flush };
}

export async function waitForHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 500) return response.status;
    } catch (error) { lastError = error; }
    await delay(100);
  }
  throw new Error(`preview server did not become ready: ${lastError?.message ?? url}`);
}

export async function launchPreferredBrowser(chromium) {
  const attempts = [];
  const commonArgs = ['--disable-background-networking', '--disable-component-update', '--no-default-browser-check'];
  const candidates = [
    { name: 'system-chrome-channel', options: { channel: 'chrome', headless: true, args: commonArgs } },
    { name: 'system-edge-channel', options: { channel: 'msedge', headless: true, args: commonArgs } },
  ];
  if (process.platform === 'win32') {
    candidates.push(
      { name: 'system-chrome-executable', options: { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: commonArgs } },
      { name: 'system-edge-executable', options: { executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: commonArgs } },
    );
  }
  candidates.push({ name: 'playwright-managed-chromium', options: { headless: true, args: commonArgs } });
  for (const candidate of candidates) {
    try {
      if (candidate.options.executablePath) await fs.access(candidate.options.executablePath);
      const browser = await chromium.launch(candidate.options);
      return { browser, name: candidate.name, options: candidate.options, version: browser.version(), attempts };
    } catch (error) {
      attempts.push({ name: candidate.name, message: error.message });
    }
  }
  const error = new Error('No Playwright browser binary could be launched');
  error.attempts = attempts;
  throw error;
}

export async function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => {});
  } else {
    child.kill('SIGTERM');
  }
  await delay(100);
}

export async function writeJson(pathname, value) {
  await fs.writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
