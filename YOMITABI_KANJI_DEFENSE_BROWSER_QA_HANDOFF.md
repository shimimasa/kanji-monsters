# YOMITABI 漢字防衛隊 Browser QA Handoff

Status: **EXECUTION SHEET — REAL BROWSER REQUIRED**
Prepared: 2026-09-12

## 1. Purpose and boundary

この文書は、実ブラウザーを利用できる担当者が「漢字防衛隊」の未完了Browser Gateを実行し、第三者が追跡可能な証拠でPASS / CONDITIONAL PASS / FAILを決めるための作業票である。教材の正しさは判定しない。Node/DOM自動テスト、CSS source、画面推測はreal-browser evidenceの代替にしない。

既に自動確認済みなのはretry、escape、routeBroken、IME event gate、pause OR、stale rejection、observer isolation、10-cycle cleanup、Storage isolationである。これらはrisk reduction evidenceであり、実layout・実IME・soft keyboard・runtime performanceを認証しない。

## 2. Environment record

```text
QA date:
Tester:
OS:
OS version:
Browser:
Browser version:
Device / emulator:
Pointer / touch / keyboard:
Input method:
Japanese IME and version:
Viewport CSS width × height:
Device pixel ratio:
Build / commit:
Server URL:
Reduced motion setting:
Evidence directory:
```

Build identityは`git rev-parse HEAD`と`git status --short`を記録する。production build対象なら`npm run build`後に`npm run preview -- --host 127.0.0.1`、development確認なら`npm run dev -- --host 127.0.0.1`を使用する。実際に表示したURLとbuild方法を必ず残す。

## 3. Required browser matrix

| ID | Environment | Required | Result | Evidence |
| --- | --- | --- | --- | --- |
| B-DESKTOP | Desktop, 1280 × 720以上 | YES | NOT RUN | |
| B-PORTRAIT | Mobile portrait, 390 × 844 | YES | NOT RUN | |
| B-LANDSCAPE | Mobile landscape, 844 × 390 | YES | NOT RUN | |
| B-P360 | Mobile portrait, 360 × 800 | Optional | NOT RUN | |
| B-TABLET | Tablet, 768 × 1024 | Optional | NOT RUN | |

Required三環境は同じbuildで行う。Mobileのsoft keyboardはviewport resizeだけのdesktop simulationではなく、可能なら実端末、次点で実IME入力可能なdevice emulatorを使い、使用方法を記録する。

## 4. Required smoke flow

各required環境で少なくとも一回、次を順に通す。内容を早く進めるためにDevToolsからCoreを直接変更しない。

| Step | Action | Expected | Actual | Result |
| ---: | --- | --- | --- | --- |
| 1 | Titleを表示 | `旗艦ゲーム：漢字防衛隊`が選択可能 | | NOT RUN |
| 2 | ゲーム起動 | board/HUD/Back/Companionが表示 | | NOT RUN |
| 3 | first Monsterを待つ | Act 1で1体、promptとlaneが読める | | NOT RUN |
| 4 | Monster選択 | markerと文言で選択状態が分かりinputへ移れる | | NOT RUN |
| 5 | かなreading入力 | IME入力中に意図しないsubmitなし | | NOT RUN |
| 6 | correct | 対象だけ撃退、score/combo更新 | | NOT RUN |
| 7 | first wrong | Monster/life維持、combo reset、hintと再回答表示 | | NOT RUN |
| 8 | retry correct | 同じMonsterを一度だけ撃退 | | NOT RUN |
| 9 | second wrong | terminal feedbackが一度、lifeは減らない | | NOT RUN |
| 10 | escape | lifeが一度だけ減る | | NOT RUN |
| 11 | two Monsters | target switchingとpriority判断が可能 | | NOT RUN |
| 12 | three Monsters | 3体を識別、prompt/threat/input/HUDが読める | | NOT RUN |
| 13 | combo | 連続正解で表示更新 | | NOT RUN |
| 14 | route end/result | resultが一度表示される | | NOT RUN |
| 15 | Replay | 新session、DOM/入力の二重化なし | | NOT RUN |
| 16 | Back | Titleへ戻り、残留Monster/Companion/inputなし | | NOT RUN |

## 5. Real Japanese IME cases

実Japanese IMEを有効にし、input値、選択target、feedback、consoleを観察する。

| Case | Action | Expected | Actual | PASS/FAIL |
| --- | --- | --- | --- | --- |
| IME-01 | inputでcomposition開始 | composing状態の文字だけ表示、submitなし | | NOT RUN |
| IME-02 | composition中にEnter | submit、score、attempt消費なし | | NOT RUN |
| IME-03 | compositionupdateを複数回 | target/attempt不変、途中文字で採点なし | | NOT RUN |
| IME-04 | compositionend | 確定文字がinputに残る、勝手にsubmitなし | | NOT RUN |
| IME-05 | composition終了後Enter | 確定readingを一回だけsubmit | | NOT RUN |
| IME-06 | Enter連打/key repeat | duplicate completionなし | | NOT RUN |
| IME-07 | composition中に別targetを選択 | old attemptが誤submitされない | | NOT RUN |
| IME-08 | composition中にfocusを外す | unexpected submitなし | | NOT RUN |
| IME-09 | composition中にpause/resume | pause中Core入力なし、確定前文字を誤submitしない | | NOT RUN |
| IME-10 | composition中にBack | Titleへ戻り、late composition callback無効 | | NOT RUN |

IME PASSには、composition中submit 0、確定後一回だけsubmit、focus/target/pause/Back競合でold attempt受理0がすべて必要。

## 6. Soft keyboard and orientation

| Check | Portrait 390 × 844 | Landscape 844 × 390 | Evidence |
| --- | --- | --- | --- |
| focused inputがkeyboardに隠れない | NOT RUN | NOT RUN | |
| selected Monsterが識別できる | NOT RUN | NOT RUN | |
| nearest threatが認識できる | NOT RUN | NOT RUN | |
| boardが完全に隠れない | NOT RUN | NOT RUN | |
| page scrollが固定/迷子にならない | NOT RUN | NOT RUN | |
| keyboard close後にlayout復帰 | NOT RUN | NOT RUN | |
| orientation change後にlayout復帰 | NOT RUN | NOT RUN | |
| focusによる過大なlayout jumpなし | NOT RUN | NOT RUN | |

## 7. Computed touch targets

DevToolsのcomputed/bounding box値を記録する。幅・高さのどちらも44 CSS px以上をPASS条件とし、source CSSだけでは判定しない。

| Control | Environment | Computed width | Computed height | Result |
| --- | --- | ---: | ---: | --- |
| Monster target | portrait | | | NOT RUN |
| Submit | portrait | | | NOT RUN |
| Back | portrait | | | NOT RUN |
| Replay | portrait/result | | | NOT RUN |
| pause control（Host側） | portrait | | | NOT RUN |
| Monster target | landscape | | | NOT RUN |
| Submit | landscape | | | NOT RUN |
| Back | landscape | | | NOT RUN |
| Replay | landscape/result | | | NOT RUN |

## 8. Overflow and computed layout

各required viewportで`scrollWidth <= clientWidth`をdocument element、body、game root、boardについて記録する。意図的な内部scrollがある場合は理由と操作可能性を記録する。

| Viewport | Element | clientWidth | scrollWidth | Unexpected overflow | Result |
| --- | --- | ---: | ---: | --- | --- |
| 390 × 844 | documentElement | | | | NOT RUN |
| 390 × 844 | body | | | | NOT RUN |
| 390 × 844 | game root | | | | NOT RUN |
| 390 × 844 | board | | | | NOT RUN |
| 844 × 390 | documentElement | | | | NOT RUN |
| 844 × 390 | body | | | | NOT RUN |
| 844 × 390 | game root | | | | NOT RUN |
| 844 × 390 | board | | | | NOT RUN |

## 9. Three-Monster visual and threat review

3体同時のscreenshotをrequired viewportごとに保存し、次を判定する。

| Criterion | Desktop | Portrait | Landscape | Notes |
| --- | --- | --- | --- | --- |
| 3 lanesを区別できる | NOT RUN | NOT RUN | NOT RUN | |
| 各promptを読める | NOT RUN | NOT RUN | NOT RUN | |
| selected targetが色以外でも明確 | NOT RUN | NOT RUN | NOT RUN | |
| danger/threatが文言・位置でも分かる | NOT RUN | NOT RUN | NOT RUN | |
| inputとselected Monsterを対応できる | NOT RUN | NOT RUN | NOT RUN | |
| life/combo/progressを読める | NOT RUN | NOT RUN | NOT RUN | |
| Companionが操作やpromptを遮らない | NOT RUN | NOT RUN | NOT RUN | |

`接近中 / 近い / 危険`等が、grayscaleや色覚差があっても文字・距離・markerで区別できることを確認する。

## 10. Focus, keyboard, pause and visibility

- Keyboard-onlyでMonster selection、reading input、Submit、Back、Replayへ到達する。
- Tab orderが画面順と大きく矛盾せず、focus-visibleが常に識別できる。
- Manual pause中はmovement/spawn/inputが停止し、resume後に位置とtyped textが維持される。
- Visibility testはtabをhiddenにして10秒以上待ち、復帰直後にbackground時間をcatch-upして全滅しないことを確認する。

| Case | Expected | Actual | Result |
| --- | --- | --- | --- |
| Keyboard-only full path | mouse/touchなしで完走可能 | | NOT RUN |
| Focus indicator | 主要controlすべて明確 | | NOT RUN |
| Manual pause | movement/spawn/input停止、resume維持 | | NOT RUN |
| Hidden tab return | bounded resume、即時全滅なし | | NOT RUN |

## 11. Reduced motion and image failure

- OS/browserで`prefers-reduced-motion: reduce`を有効化し、position/threat/selection/feedbackが理解可能か確認する。
- DevTools request blocking等でMonster imageを一つ失敗させ、text fallback、layout、selection、Core進行を確認する。外部教材や製品sourceは変更しない。

## 12. Runtime, network and scheduler evidence

開始前にconsole/network logをclearし、smoke flowと10-cycle中の全errorを保存する。

| Area | Required evidence | Result |
| --- | --- | --- |
| Console | error、uncaught exception、unhandled rejection、warning一覧 | NOT RUN |
| Network | URL/method/status一覧、unexpected external request 0 | NOT RUN |
| Scheduler | game固有の追加RAF/continuous intervalが見えない | NOT RUN |
| Performance | 3体時、入力、switch、submit、image decode、Replay後の観察/trace | NOT RUN |

既存warningと判断した場合もmessage、発生手順、既知根拠を残す。console error、uncaught exception、unhandled rejectionは原則BLOCKER。

## 13. Ten-cycle lifecycle

同一browser tabで最低10 cycleを行う。例: `enter → partial play → Back → enter → full play → Replay → Back`。cycleごとにMonster/Companion/root数、double fire、体感latencyを記録する。

| Cycle | Exit path | Duplicate DOM/listener/input | Performance change | Result |
| ---: | --- | --- | --- | --- |
| 1 | | | | NOT RUN |
| 2 | | | | NOT RUN |
| 3 | | | | NOT RUN |
| 4 | | | | NOT RUN |
| 5 | | | | NOT RUN |
| 6 | | | | NOT RUN |
| 7 | | | | NOT RUN |
| 8 | | | | NOT RUN |
| 9 | | | | NOT RUN |
| 10 | | | | NOT RUN |

## 14. Screenshot and file naming requirements

最低6枚を保存する。`browser-<browser>-<viewport>-<scenario>-<date>.png`を使用する。

1. `first-monster`
2. `first-wrong-retry`
3. `three-monsters`
4. `soft-keyboard`
5. `landscape`
6. `result`

例: `browser-chrome-390x844-three-monsters-2026-09-12.png`。console/network exportやtraceは同じprefixを使う。画像に個人情報、account、他tabの内容を含めない。

## 15. Issue evidence format

```text
Issue ID: KD-BROWSER-___
Viewport:
Browser / version:
OS / device:
Input / IME:
Build / commit:
Steps:
Expected:
Actual:
Severity: MINOR / BLOCKER
Screenshot / video:
Console / network:
Reproducibility:
Decision / owner:
```

## 16. Classification and blockers

- `PASS`: expected resultを満たし、証拠がある。
- `MINOR`: child testを歪めず回避不要な軽微issue。根拠を記録する。
- `BLOCKER`: child testの操作・安全・測定を歪める。
- `NOT RUN`: 未実施、環境不足、証拠不足。PASSとして集計しない。

BLOCKER例: IME double submit、soft keyboardでinput/選択targetが操作不能、主要target選択不能、overflowでcontrol欠落、pause中movement/input、duplicate completion、runtime crash/unhandled rejection、顕著なframe degradation、44px未満により主要操作が困難、Back/Replay cleanup failure。

## 17. Final browser decision

```text
Desktop: PASS / CONDITIONAL PASS / FAIL / NOT RUN
390 × 844: PASS / CONDITIONAL PASS / FAIL / NOT RUN
844 × 390: PASS / CONDITIONAL PASS / FAIL / NOT RUN
Actual Japanese IME: PASS / FAIL / NOT RUN
Soft keyboard: PASS / FAIL / NOT RUN
Touch / overflow: PASS / FAIL / NOT RUN
Runtime blockers: 0 / ___
Open MINOR issues:
Open BLOCKER issues:
Evidence directory:
Tester:
Date:

BROWSER FINAL:
PASS / CONDITIONAL PASS / FAIL

Rationale:
```

PASSはrequired環境とIME/soft keyboardを含む全critical caseが証拠付きで完了し、child playtestを妨げるissueが0の場合だけ。CONDITIONAL PASSはminorのみで、各minorがplaytest measurementを歪めない理由とownerが必要。FAILまたはNOT RUNがcritical gateに一つでもあればchild playtestへ進めない。

`BROWSER QA HANDOFF READY`
