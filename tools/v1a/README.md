# V1a GLB integration checkpoint

This checkpoint preserves HKD-E01 GLB v1a.1 integration with Babylon core/loaders
9.25.0. Its performance verdict is **V1a CONDITIONAL GO**, not full performance
acceptance. See the integration and performance reports at the repository root.

## Clean product verification

Use a new detached worktree at the checkpoint commit, Windows, Node 22.14.0 and
npm 10.9.2. Do not copy node_modules, dist, fixtures or artifacts from another tree.

```powershell
npm.cmd ci
node tools/v1a/regression.mjs
```

The runner executes phase-a/b/c/no-go (86/22/17/143 = 268), V0 (23), V1a (35),
stage integrity and production build. Require 326 tests passing and zero failures,
cancelled, skipped or todo, with integrity/build exit 0. It writes local logs under
ignored artifacts/v1a/regression; use a fresh tree to preserve prior evidence.
This verification needs no browser, sibling worktree or fixture.

## Integration diagnostic sources

run.mjs, server.mjs, diagnostic.mjs, diagnostic-probe.js, faults.mjs and
visual-scope.mjs preserve the integration observation and fault injection sources.
Their shared dependencies are already committed in tools/experiment and tools/v0.
See tools/experiment/README.md for isolated fixture generation from the stable save
API. Fixture contents and validator outputs are generated locally, never committed.
The historical runner retains the experiment workspace path and integration-01
evidence directory. It is not a portable automatic regression or the formal V1a
performance runner. Do not invoke it on existing evidence to recreate old runs.
Future diagnostics require an explicitly scoped new attempt and the documented
isolated server/profile setup. Each headed performance attempt requires its own
human readiness confirmation and foreground monitoring.

audit.mjs preserves the pre-commit integration audit, including the asset-checkpoint
HEAD assertion. It intentionally cannot certify the later checkpoint SHA. It reads
historical local logs and is not part of clean product verification.

Raw evidence, profiles, fixture files, Storage, Network, screenshots, traces,
temporary JSON, dist and node_modules are excluded. Report artifacts links refer
to retained local evidence, intentionally absent from clean checkouts. Historical
benchmark and tools/v1a-performance files remain local; they are not dependencies
of this integration source or its 326-test reproduction.

## Mandatory V1b constraints

- GLB ready must never gate answering; animation completion must never gate progress.
- Resources owned by exited sessions must not accumulate.
- V1a exceeded the 2D-relative idle CPU +5 percentage-point target in 2/3 pairs.
  Background additions must not worsen this; CPU/cold stall must be reevaluated.
- Tutorial-read cold entry has 117–225 ms Long Tasks immediately after answering
  becomes possible. Frame preservation does not imply absence of cold stalls.
- Keep KNOWN-2D-PAD-TUTORIAL and other known 2D issues separate from 3D regressions.
- Tutorial-read pair 1 uses different Chrome patch versions; it is not evidence
  for three pairs on one identical browser version.
- Preserve the Asset Spec STOP criteria and the Performance Report limitations.
  This checkpoint does not authorize background production in the freeze session.
