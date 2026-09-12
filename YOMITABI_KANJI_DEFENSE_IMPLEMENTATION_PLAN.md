# YOMITABI 漢字防衛隊 Implementation Plan

Date: 2026-09-12

## Phase 0 — repo / Git / checkpoint audit

Portfolio tag `yomitabi-minigame-production-portfolio-2026-09`、clean worktree、専用`product/kanji-defense` branchを確認する。main側のFirebase cache・3D資料等はscope外で触れない。

## Phase 1 — Math Invader reuse audit

Reuse: Host-driven update、3-lane authoritative entity state、select/attempt identity、pause、cleanup。Rewrite: arithmetic generator/input、全選択中freeze、wrongでlife減、flat 10問、probe UI/result。Do not inherit: constants、numeric pad、minimal enemy label、speed tuning。共通lane engineは作らない。

Option B、新`kanjiDefense`を採用する。code duplicationは小さなgame-local Coreに限定し、probe evidence、rollback、test clarityを優先する。

## Phase 2 — content audit

Grade 4 202 recordsの欠落・重複・reading形式を検査し、source IDへ追跡可能な24語golden subsetを作る。60語はdouble editorial review後に追加する。Monsterはexisting中部12体とasset pathを静的検証する。

## Phase 3 — Production Spec freeze

`YOMITABI_KANJI_DEFENSE_PRODUCTION_SPEC.md`を実装境界とする。1 encounter = 1 presented problem、1 retry、1 terminal event、escape = terminal incorrect、lifeはescapeのみ、音なしMVPをfreezeする。

## Phase 4 — Core

`kanjiDefenseGame.js`にsession generation、deterministic content/Monster selection、3-act spawn、O(3) movement、target/attempt gates、retry、escape、life/combo/score、result、observer isolationを実装する。

## Phase 5 — View

`kanjiDefenseView.js`に3 lanes、Monster image/text fallback、危険文字、pointer/touch/1〜3 selection、composition-safe text input、feedback、HUD、result/replay/back、responsive/reduced-motion CSSを実装する。

## Phase 6 — content integration

`kanjiDefenseContent.js`にimmutable content/Monster pack、normalizer、seeded session builder、fixture validatorを実装する。runtime dataset scanやnetwork loadは行わない。

## Phase 7 — Companion / audio / motion integration

既存Host Companion integrationだけを使用する。adapter変更0。新audioは追加せずsilent-safe、animationはCSS presentationだけとし、Core correctnessに使わない。

## Phase 8 — tests

`tests/minigame-production-kanji-defense`へcore/lifecycle/scope/scope-contractを追加する。既存Contract exact surfaceを維持し、historic hash testは新しいreview済みregistry/title hashだけ追加する。

## Phase 9 — full regression

全test directoryをserialized実行し、pass/fail/cancelled/skipped/todoをsuite別に記録する。assertion削除、skip、todo、weakeningは禁止。

## Phase 10 — Browser Certification

利用可能なin-app browser bindingでVite appを操作し、desktop、390×844、844×390、keyboard/IME、pause/visibility可能範囲、3体、image fallback、replay/back、console/network/scheduler/performanceを検査する。binding不足ならrelease blocked。

## Phase 11 — content QA

schema/source automated QAと、教育editorial certificationを分離する。後者は人間review完了までpendingと明記する。

## Phase 12 — final production audit

stage integrity、diff check、build、package/lock、protected Host/adapters/public/save/main RAF、bundle deltaを確認し、implementation reportとlocal checkpointを作る。pushはしない。

## MVP scope freeze

In: 3 lanes、最大3体、最大12 encounters、Grade 4 golden pack、かな入力、1 retry、escape、life、combo、score、Companion、pause、Back、Replay、result、responsive/accessibility。

Out: persistent rewards、XP、rank、daily、leaderboard、multiplayer、teacher dashboard、adaptive AI、complex boss、Collection unlock、stage mutation、inventory、skill tree、network content、Contract v2、新audio framework。

## Implementation decision gate

- Math Invader direct upgrade: **NO**。
- New `kanjiDefense`: **YES**。
- LearningEvent 4 types sufficient: **YES**。
- Retry safe: **YES**、intermediate wrongはgame-local、terminalのみevent。
- Escape safe: **YES**、`incorrect` + `reason: escaped`。
- Host change: **0 planned**。
- Persistent rewardなしのMVP価値: **YES**。
