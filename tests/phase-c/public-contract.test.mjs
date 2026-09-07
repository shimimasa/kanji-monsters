import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('public product name is 漢字ヨミタビ', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const html = fs.readFileSync('index.html', 'utf8');
  assert.equal(manifest.name, '漢字ヨミタビ');
  assert.match(manifest.short_name, /ヨミタビ/);
  assert.match(html, /<title>漢字ヨミタビ<\/title>/);
});

test('Firebase SDK does not block initial HTML parsing', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.doesNotMatch(html, /<script[^>]+gstatic\.com\/firebasejs/);
});

test('service-worker retirement only deletes this product caches', () => {
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(sw, /isYomitabiCache/);
  assert.match(html, /isYomitabiCache/);
  assert.doesNotMatch(sw, /names\.map\(name => caches\.delete\(name\)\)/);
  assert.doesNotMatch(html, /names\.map\(n => caches\.delete\(n\)/);
});

test('background image URLs do not use a per-request timestamp', () => {
  const source = fs.readFileSync('src/loaders/assetsLoader.js', 'utf8');
  assert.doesNotMatch(source, /const timestamp = Date\.now\(\)/);
});
