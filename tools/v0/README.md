# V0 verification sources

## Reproduce the committed product regression

Use Node 22.14.0 / npm 10.9.2 (the freeze verification environment) and Windows.
In a new clean worktree at the V0 commit, run:

```powershell
npm.cmd ci
node tools/v0/regression.mjs
```

The runner invokes the unchanged phase-a/b/c/no-go commands, then
`node --experimental-default-type=module --test tests/v0/*.test.mjs`,
`node scripts/verify_stage_id_integrity.mjs`, and `npm.cmd run build`.
Expected results: 86 + 22 + 17 + 143 = 268 existing tests; 23 V0 tests;
zero failures/cancelled/skipped/todo; integrity and build exit 0.
Logs are generated only under ignored `artifacts/v0/`.
No sibling worktree, browser profile, fixture, raw evidence, or previous build is
needed for this regression command. Do not copy node_modules or dist from another worktree.

## Browser measurement and retained evidence

The browser sources reproduce the Windows-specific E0 lab used in the technical
report. They depend on the committed `tools/experiment/` sources. `run.mjs` and
`fault-run.mjs` intentionally retain the paths and observation logic used for the
reported runs; measurements must run from the experiment worktree described in
the report, with the sibling stable `baseline-2d` worktree. Build each role first.
Create fresh fixture/validator files using the stable save API and the E0 setup
instructions in `tools/experiment/README.md`, then use `tools/v0/server.mjs` with
`--baseline`, `--experiment`, and `--run` pointing to those worktrees and a new
evidence directory. Current recorded runner paths use `artifacts/v0/run-01`.

For each headed run, the runner creates a fresh exclusive profile, opens E0 setup,
and stops at `<role>-<attempt>-waiting.json`. Obtain a separate explicit human
`準備完了` for that run before creating its `-human-ready.json`. Include
`userMessage`, `receivedAt`, `role`, `attempt`, and a scope naming only that run.
The runner waits another 15 seconds before arming foreground monitoring. Never
create `batch-human-ready.json` for the six-run protocol: the convenience batch
driver would otherwise propagate one acknowledgement across all remaining runs.
Use unique attempt names and preserve previous evidence; profiles are not reused.

The diagnostic and fault runners are separate from headed performance runs.
`analyze.mjs`, `audit.mjs`, `fault-audit.mjs`, `foreground-details.cjs`, and
`final-verify.cjs` inspect previously collected local evidence. They do not create
missing evidence or replace clean product regression. `audit.mjs` uses the parser
already installed through the pinned Vite/Rollup dependency; no extra acorn install
is required. `foreground-control.cjs` restores only a named dedicated waiting
profile and checks the product hash; it never grants readiness.

Only source files and the summarized technical report are committed. Profiles,
fixture contents, Network records, screenshots, Storage dumps, logs, dist, and
node_modules remain excluded. Links from the report into `artifacts/v0/` refer to
the locally retained evidence and are intentionally absent from a clean checkout.

The old one-time `prepare-tools.mjs` and `prepare-fault-runner.mjs` generators are
not part of the freeze: they depend on historical untracked B0 source copies and
are unnecessary once the resulting V0 tools are committed. They are left untouched
in the original worktree.
