# YOMITABI 漢字防衛隊 Content Pre-Review

Date: 2026-09-12

Status: **AI/engineering pre-review only — not editorial certification**

## Current human-review state — 2026-09-12

The returned repository contains no completed human review record. Reviewer identifier, review date, content version/sign-off and all 24 item-level human decisions are blank in `YOMITABI_KANJI_DEFENSE_HUMAN_CONTENT_REVIEW_PACK.md`. Consequently Human APPROVE = **0**, no child-test subset can be frozen, and the two-character hint policy remains unresolved. The item table below remains AI/engineering pre-review evidence only.

`EDITORIAL HUMAN REVIEW STILL REQUIRED`

## Limited UX playtest control

The three `REVISE` items (`以下`, `位置`, `結果`) are excluded from the runtime default candidate pool. The remaining 21 `APPROVE (PRE)` items form `LIMITED UX PLAYTEST PRE-REVIEWED POOL`, content version `kanji-defense-limited-ux-playtest-pre-reviewed-v1`. A session draws 12 without duplicates. This exception is valid only for supervised exploratory UX observation; it does not change Human APPROVE = 0 or the formal release gate.

`HUMAN CONTENT REVIEW REQUIRED FOR PUBLIC RELEASE`

## Review boundary

All 24 immutable golden items were compared with the current Grade 4 source IDs, their displayed word, accepted reading, short meaning, metadata hint, and the runtime first-kana/character-count retry hint. This review can find consistency and obvious wording risks; it cannot replace a Japanese-language curriculum/editorial reviewer or child comprehension testing.

Decision `APPROVE (PRE)` means suitable to send to human review. It does not authorize child use. `REVISE` means exclude from the first child-test subset until corrected and reviewed.

## Item review

| Prompt | Reading | Grade Fit | Naturalness | Ambiguity | Meaning | Hint | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 愛犬 | あいけん | Grade 4 愛 + earlier 犬 | common | none apparent | short and accurate enough | metadata natural; runtime `あ…（4文字）` appropriate | APPROVE (PRE) |
| 案内 | あんない | Grade 4 案 + earlier 内 | very common | none apparent | accurate and child-readable | metadata/runtime appropriate | APPROVE (PRE) |
| 以下 | いか | Grade 4 以 + earlier 下 | common | none apparent | wording `その数をふくんで下` is incomplete | runtime `い…（2文字）` reveals half the answer | **REVISE** |
| 位置 | いち | both Grade 4 | very common | none apparent | accurate | runtime `い…（2文字）` reveals half the answer | **REVISE** |
| 印刷 | いんさつ | both Grade 4 | common | none apparent | accurate and concrete | appropriate | APPROVE (PRE) |
| 英語 | えいご | Grade 4 英 + earlier 語 | very common | none apparent | understandable; reviewer should confirm geographic simplification | appropriate | APPROVE (PRE) |
| 栄養 | えいよう | both Grade 4 | very common | none apparent | accurate and concise | appropriate | APPROVE (PRE) |
| 塩分 | えんぶん | Grade 4 塩 + earlier 分 | common | none apparent | accurate | appropriate | APPROVE (PRE) |
| 一億 | いちおく | Grade 4 億 + earlier 一 | common in curriculum | none apparent | mathematically accurate | `大きな数`; runtime hint appropriate | APPROVE (PRE) |
| 加入 | かにゅう | Grade 4 加 + earlier 入 | moderately common | none apparent | understandable | appropriate | APPROVE (PRE) |
| 結果 | けっか | both Grade 4 | very common | none apparent | `あとに出たもの` is vague | `行ったあとの答え` narrows meaning too far | **REVISE** |
| 貨物 | かもつ | Grade 4 貨 + earlier 物 | common in transport context | none apparent | accurate | appropriate | APPROVE (PRE) |
| 課題 | かだい | Grade 4 課 + earlier 題 | very common at school | none apparent | accurate | appropriate | APPROVE (PRE) |
| 改良 | かいりょう | both Grade 4 | common | none apparent | accurate | appropriate | APPROVE (PRE) |
| 機械 | きかい | both Grade 4 | very common | none apparent | accurate and concrete | appropriate | APPROVE (PRE) |
| 害虫 | がいちゅう | Grade 4 害 + earlier 虫 | common | none apparent | accurate | appropriate | APPROVE (PRE) |
| 街灯 | がいとう | both Grade 4 | common | none apparent | accurate | appropriate | APPROVE (PRE) |
| 各地 | かくち | Grade 4 各 + earlier 地 | common | none apparent | accurate | appropriate | APPROVE (PRE) |
| 覚える | おぼえる | Grade 4 覚 + okurigana | very common | `覚める` is a different spelling/okurigana | accurate | appropriate | APPROVE (PRE) |
| 完成 | かんせい | both Grade 4 | very common | none apparent | accurate | appropriate | APPROVE (PRE) |
| 関係 | かんけい | Grade 4 関 + earlier 係 | very common | none apparent | accurate | appropriate | APPROVE (PRE) |
| 観察 | かんさつ | both Grade 4 | very common in science | none apparent | accurate and useful | appropriate | APPROVE (PRE) |
| 希望 | きぼう | both Grade 4 | very common | none apparent | accurate | appropriate | APPROVE (PRE) |
| 季節 | きせつ | both Grade 4 | very common | none apparent | accurate and concrete | appropriate | APPROVE (PRE) |

## Decision summary

- APPROVE (PRE): **21**
- REVISE: **3** (`以下`, `位置`, `結果`)
- REMOVE: **0**
- Human-editorially certified: **0**

The 21 pre-approved candidates exceed the recommended 16-item minimum for a unique 12-encounter playtest pack, but none may be called certified until a human reviewer signs off. The first human pass should confirm compound grade burden, standard reading, regional/dialect variants, wording, and the two-character hint policy. A second reviewer should blind-answer the final subset.

## Required revisions before human sign-off

1. Rewrite `以下` meaning as a complete child-readable definition and decide whether two-character readings receive a different hint or are excluded.
2. Apply the same short-reading hint decision to `位置`.
3. Rewrite `結果` meaning/hint so that it covers an outcome rather than only an answer.
4. Add reviewer name, review date, approved reading/version, and decision provenance to the content manifest or release record before child use.

## Certification decision

`CONTENT PRE-REVIEW COMPLETE`

`EDITORIAL HUMAN REVIEW STILL REQUIRED`

`RELEASE CERTIFICATION BLOCKED: CONTENT REVIEW PENDING`
