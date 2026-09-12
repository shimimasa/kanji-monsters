# Kanji Defense Playwright Certification Harness

This is isolated QA tooling. It is not imported by production source and does
not modify the root `package.json` or `package-lock.json`.

Install without downloading a managed browser (system Chrome/Edge is preferred):

```powershell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1'
npm.cmd install --prefix tools/kanji-defense-browser-cert
```

Run a fresh production build, preview server, and Chromium certification:

```powershell
npm.cmd --prefix tools/kanji-defense-browser-cert run certify
```

The harness chooses a free loopback port, runs the root production build,
starts Vite preview, launches system Chrome first and Edge second, writes one
timestamped run under `artifacts/kanji-defense/browser-certification/`, and
always closes the browser/server in `finally`.

Output includes `result.json`, `summary.md`, screenshots, `console.json`,
`network.json`, `measurements.json`, and `performance.json`. The repository
ignores `artifacts/` and nested `node_modules/`.

Synthetic composition events certify the application event gate only. They do
not certify a physical Windows Japanese IME. Viewport/focused-input shrinking
does not certify a real mobile soft keyboard. Those remain manual gates.
