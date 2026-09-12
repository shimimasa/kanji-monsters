# YOMITABI 漢字防衛隊 Playwright Browser Certification Report

Date: 2026-09-12
Branch: `product/kanji-defense`
HEAD: `cd1056b3f2fe9540ee65a0869ba504e61ad36e38`
Checkpoint tag: `yomitabi-kanji-defense-mvp-2026-09`
Evidence run: `artifacts/kanji-defense/browser-certification/run-20260912T110959Z/`

## 1. Executive Summary

QA 専用 Playwright harness を product runtime から隔離して導入し、fresh production build を Vite preview で配信して system Chrome の実レンダリングを検証した。最終 run は **47 / 47 checks PASS、FAIL 0、NOT_RUN 0**。Desktop、390×844、844×390、computed geometry、retry / escape / 2・3体、keyboard、composition event、pause、CDP lifecycle、reduced motion、image failure、runtime、network、performance、10-cycle を自動認証した。

初回の目視監査で 844×390 の入力欄下端が viewport 外へ 24 px 出る blocker を発見した。低高さ landscape の board を `170px` から `140px` へ縮める最小 CSS 修正後、input / Submit の下端は `384px` となり完全表示を確認した。

Playwright run単体ではActual Windows Japanese IMEとreal mobile soft keyboardを認証対象外としていた。その後、`Project owner / manual QA`が2026-09-12に両manual checklistの必須項目をすべてPASSしたと明示し、`YOMITABI_KANJI_DEFENSE_MANUAL_INPUT_CERTIFICATION.md`へ正式記録した。したがって現在のBrowser/Input gateはcomplete。Human Content Reviewとfull-session adult QAは別gateで未完了であり、child playtestはまだ許可しない。

## 2. Environment

| Item | Value |
| --- | --- |
| OS / arch | Windows / x64 |
| Node | v22.14.0 |
| Browser | system Chrome channel |
| Chrome | 152.0.7977.83 |
| Mode | headless, real Chromium renderer |
| Locale / timezone | ja-JP / Asia/Tokyo |
| Main viewport | 1280×720 |
| Responsive | 390×844、390×500 proxy、844×390 |

## 3. Playwright Setup

`tools/kanji-defense-browser-cert/` は独立した private npm package で、`@playwright/test@1.63.0` はその `devDependencies` のみ。root `package.json` / `package-lock.json` は変更していない。production source は Playwright を import せず、QA 専用 localStorage fixture、network interception、CDP instrumentation は incognito browser context 内だけで使用する。

実行コマンド:

```powershell
npm.cmd --prefix tools/kanji-defense-browser-cert run certify
```

## 4. Browser Binary

Priority A の system Chrome channel が一度で起動した。Edge fallback と Playwright-managed Chromium は未使用で、managed browser download は行っていない。

## 5. Build / Server

Harness が `npm run build`、free loopback port、Vite preview、ready check、browser close、server cleanup を実行した。最終 run URL は `http://127.0.0.1:60034/`。Build は Vite 5.4.19、125 modules、main JS 649.82 kB / gzip 196.49 kB、CSS 48.35 kB / gzip 8.73 kB。preview child processのcleanupも接続拒否で確認した。

limited UX pool変更後の source-of-truth regression は **70 test files、649 PASS、fail / cancelled / skipped / todo = 0**。stage ID integrity、`git diff --check`、production build も PASS した。root `package.json` / `package-lock.json` と Host / LearningEvent / Companion / Collection に差分はない。Playwright tooling に起因する production import / chunk / bundle size delta は 0。21-item pool定義によりmain JSは旧run比+0.12 kB / gzip +0.05 kB、CSSは不変である。

## 6. Desktop

1280×720 で Title から起動し、first Monster、正解、first wrong / retry、retry correct、second wrong terminal、escape / life decrement、2体、3体、result、Replay、Back を完走した。first Monster、retry、3体、result の screenshot を保存した。

## 7. Portrait

390×844 で3 lane、3 prompts、選択 marker、threat、HUD、input、Submit、Back が同時表示された。document / body / root はいずれも clientWidth = scrollWidth = `390`。Monster は `108.58×100`、input は `270.94×48`、Submit は `96.06×48`。

## 8. Landscape

844×390 は修正後 PASS。document / body / root は clientWidth = scrollWidth = `844`。board は `730×140`、Monster は `215.39×61.89`、input は `733.94×48`（y 336、bottom 384）、Submit は `87.06×48`（bottom 384）。主要操作は viewport 内に完全表示された。result も overflow なしで Back / Replay を操作可能。

## 9. Touch Targets

Computed bounding box の最小高さは Back / Replay の `44px`。Monster は最小 `61.89px`、Submit / input は `48px`。Desktop、390×844、844×390、result の主要操作はすべて width / height とも 44 CSS px 以上。

## 10. Overflow

1280×720、390×844、390×500、844×390 の documentElement、body、game root、board で `scrollWidth <= clientWidth`。意図しない horizontal overflow は 0。

## 11. Three-Monster

Act 3 を実 game flow で作り、3 unique lanes / prompts を確認した。各 target に accessible label と threat text があり、選択 target は `aria-pressed="true"` と文字 marker「選択中」で色以外にも表現される。desktop / portrait / landscape screenshot を目視確認し、HUD と Companion による主要情報の遮蔽はなかった。

## 12. Keyboard / Focus

Tab で Back が focus-visible となり computed outline は `4px`。lane key 1 / 2 / 3 は対象 lane を選び、input に focus した。Enter submit、repeat rejection、Replay / Back lifecycle を確認し、duplicate submit はなかった。

## 13. Composition Events

Playwright が compositionstart / update / end と keydown を実 DOM に送出した。開始、composition 中 Enter、update、end、end 後 Enter、repeat Enter、連打、target switch、blur、pause、Back 後 stale event の **12 / 12 checks PASS**。

認証ラベルは `PLAYWRIGHT COMPOSITION EVENT CERTIFIED`。これは physical Windows IME の変換候補 UI / OS input pipeline の認証ではない。

## 14. Soft-keyboard Emulation

390×844 で input focus 後、viewport height を 500px に縮めた proxy scenario を実行。input bottom `429px`、selected Monster bottom `172.66px`、horizontal overflow 0。`MOBILE VIEWPORT / FOCUSED INPUT PASS` であり、real mobile keyboard の表示・OS resize policy は manual required。

## 15. Pause

Core/Host pause 設定後に350ms待機し、enemy progress、入力途中 text、paused state が不変であることを real browser 上で確認した。resume 後は通常の回答を継続できた。

## 16. Visibility

CDP `Page.setWebLifecycleState` の frozen → active を使用。600ms background proxy 後も resolved / life は不変、duplicate spawn / catch-up escape はなかった。これは CDP lifecycle certification であり、actual user tab switch の端末差は manual smoke で再確認可能。

## 17. Reduced Motion

`page.emulateMedia({ reducedMotion: 'reduce' })` で media query match、Monster transition `0s`、文字による selected marker、回答完了を確認した。

## 18. Image Failure

Monster image request を `page.route()` で意図的に abort。image は非表示、text fallback が表示され、target の accessible label、選択、正解、Core progression は維持された。

## 19. Console

Uncaught exception 0、unhandled rejection / `pageerror` 0、runtime blocker 0。raw console error には、隔離 QA で意図的に block した既存 Firebase SDK request と image-failure case の resource error が含まれるため、期待した fault-injection diagnostic として別分類した。その他の既存 asset/cloud warning は保存済みで、漢字防衛隊の crash / state failure はなかった。

## 20. Network

全 request / response / failure を保存。unexpected external request は 0。既存 platform cloud sync が要求した `https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js` は6 contextsで検出し、匿名・隔離 QA のため意図的に block した expected existing platform request として別記録した。漢字防衛隊由来の新 external content loader はない。

## 21. Performance

CDP `Performance.getMetrics` と Long Task observer を取得。game-visible long taskの最大は`147ms`でblocker threshold 200ms未満。代表 input-to-state feedback は`43ms / 35ms / 44ms`。game-owned RAF registration 0、game-owned interval 0。3体・Replay後に操作を妨げるlagは観測しなかった。

## 22. 10-cycle

同一 Chrome session で Back 5 cycle + full session / Replay 5 cycle を実施。Back 後 root 0 / Host listeners 0、Replay 後 root 1 / Companion 1、最後の Back 後 root 0 / listeners 0。duplicate Monster、double submit、Companion duplication、DOM growth は検出されなかった。

## 23. Issues

| ID | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| KD-BROWSER-001 | 844×390 で input / Submit bottom 414px、24px clipped | BLOCKER | fixed and re-certified |

Harness 開発時の `.cmd` spawn、empty-save cloud recovery、tutorial overlay、pause sampling、fault-injection classification は QA tooling defectsとして修正し、製品 defect には数えていない。

## 24. Fixes

製品修正は `kanjiDefenseView.js` の低高さ landscape board `170px → 140px` のみ。関連 lifecycle source assertionを強化した。Host、Contract、LearningEvent、Companion、Collection、save、root package/lock は未変更。

## 25. Manual Residual Gates

| Gate | Status | Reason |
| --- | --- | --- |
| Actual Windows Japanese IME | PASS — post-run manual evidence | Playwright対象外。project owner manual QAが2026-09-12にPASSを記録 |
| Real mobile soft keyboard | PASS — post-run manual evidence | Playwright対象外。project owner manual QAが2026-09-12にPASSを記録 |
| Human Content Review | PENDING / OUT OF SCOPE | Browser QAとは別のrelease gate |

## 26. Final Decision

`KANJI DEFENSE PLAYWRIGHT HARNESS READY`

`AUTOMATED REAL-BROWSER CERTIFICATION PASS`

`DESKTOP / RESPONSIVE / RUNTIME CERTIFIED`

`PLAYWRIGHT COMPOSITION EVENT CERTIFIED`

`ACTUAL WINDOWS IME PASS`

`REAL MOBILE SOFT KEYBOARD PASS`

`BROWSER / INPUT GATE COMPLETE`

`CHILD PLAYTEST STILL BLOCKED: CONTENT REVIEW PENDING`
