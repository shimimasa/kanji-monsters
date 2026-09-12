# YOMITABI 漢字防衛隊 Production Spec

Date: 2026-09-12

Status: MVP specification frozen for implementation on MiniGame Platform Contract v1.

## 1. Executive Summary

「漢字防衛隊」は、迫る地域Monsterから三本の旅路を守る、約3分の漢字読みstrategy/action gameである。プレイヤーは危険なMonsterを選び、かなで読みを入力する。読みの想起が攻撃そのものになり、target priority、combo、三幕のwaveが再プレイ動機を作る。

## 2. Product Role

YOMITABI最初のFlagship Production Game、家庭向けscore chase、授業内3分practiceを兼ねる。Math Invaderを置換せず、独立した`kanjiDefense`として追加する。

## 3. Target User

主対象は小学4〜6年生。MVP教材はGrade 4、mechanical difficultyはnormal固定。日本語IMEでかな入力できることを前提にし、学習難度と操作難度を分離する。

## 4. Learning Objective

Grade 4漢字を含む身近な語の読みを、正確に検索・入力する。速さは補助的なpressureであり、scoreはタイピング速度を直接採点しない。

## 5. Player Fantasy

プレイヤーは中部地方を進むYOMITABI隊の防衛役。Monsterの「ことばバリア」は、その語を正しく読むと破れる。Companionの攻撃は演出であり、Coreの正誤判定ではない。

## 6. Core Loop

Monster出現 → 危険度を比較 → target選択 → 読み入力 → 正解なら撃退、初回誤答ならhint付き再挑戦、2回誤答またはgate到達なら失敗完了 → 次の脅威、を繰り返す。

## 7. 3-Lane Model

左・中央・右の3 lane。1 laneにつきactive Monsterは最大1体、画面全体で最大3体。laneはidentityであり、DOM座標はsource of truthにしない。

## 8. Encounter Structure

1 encounterは1体のMonsterと1語のterminal learning outcome。Sessionは最大12 encounters。spawnされたencounterだけが`problemPresented`を持つ。

## 9. Session Arc

- Act 1、encounter 1〜4: 最大1体、低速、操作習得。
- Act 2、5〜9: 最大2体、spawn間隔とpriority判断を追加。
- Act 3、10〜12: 最大3体、高めのpressureとfinal-wave表示。

## 10. Target Selection

pointer/touch、または`1`/`2`/`3`でlaneを選ぶ。切替時は旧attempt identityを無効化し、新attemptを発行する。選択はMonsterを停止させず、全体速度を35%へ緩和する。

## 11. Reading Input

OS/ブラウザーの日本語IMEを使うtext input。独自ローマ字変換やkana keyboardは作らない。composition中のEnter、repeat、modifier付きEnterをsubmitに使わない。

## 12. Normalization

game-local関数でNFKC、trim、空白除去、カタカナ→ひらがなを行う。長音・小書き文字を推測変換せず、教材側の`acceptedReadings`で正答を明示する。

## 13. Content Model

`fixtureId`, `prompt`, `acceptedReadings`, `focusKanjiIds`, `skillId`, `meaning`, `hint`を持つ。表示textとidentityを分離し、配列とitemはimmutable。初期golden packは24語、MVP拡張目標はreview済み60語。

## 14. Monster Model

既存中部地方Monster 12体をgame-local presentation metadataとして参照する。`monsterId`, `name`, `region`, `imageUrl`を持ち、画像失敗時は文字fallbackで続行する。HPは1。

## 15. Movement

位置はCore-local `progress`（0〜gate）で、Host `update(dtMs)`だけが進める。wall clock、game-owned RAF、intervalは使わない。巨大deltaはsimulationだけ250msへboundし、background catch-upで全滅させない。

## 16. Life

開始3。gate到達時だけ1減る。誤入力だけでは減らない。0になったらactive threatを`routeBroken`として閉じ、未spawn encounterを提示せずsessionを終了する。

## 17. Combo

terminal正解で+1、途中誤答またはterminal失敗で0。最大comboを記録する。difficulty、XP、saveには影響しない。

## 18. Score

正解100、初回正解bonus 25、連続正解bonus `min(combo-1, 4) * 20`。終了時に残life×100を加える。速度bonusはMVPに入れない。

## 19. Threat Priority

各Monsterはgateまでの距離を視覚位置、`近い`/`危険`文字、aria-labelで示す。最も近い敵を先に読む判断が、入力前のstrategyを作る。

## 20. Wrong Answer / Retry

最大2 attempts。1回目の誤答はattemptをconsumeし、comboをresetし、最初のかなと文字数hintを示して新attemptを発行する。LearningEventは出さない。2回目の誤答は`incorrect`でterminal completionし、正しい読みを表示する。

## 21. Escape

gate到達はterminal `incorrect`、payload `reason: 'escaped'`。途中誤答後のescapeも同じ1 completionだけを出す。life 0時に残るactive Monsterは`reason: 'routeBroken'`で一度だけ閉じる。

## 22. LearningEvent

既存4 typesのみ。spawn時`problemPresented`、撃退時`correct`、2回誤答/escape/routeBroken時`incorrect`、終了時`sessionComplete`。途中誤答はlearning completionでないためevent化しない。これにより1 presented encounter = 1 terminal outcomeを守る。全stateをcommitしてからnotifyする。

## 23. Pause

Hostがmanual/visibilityをORした`setPaused(boolean)`を受ける。pause中はmovement、spawn、input、activeElapsedMsを停止する。resume後は位置・選択・入力内容を維持する。

## 24. Companion

既存adapterを無変更で使う。terminal `correct`はattack、terminal `incorrect`は既存idle反応。Companion画像やmotion失敗はgameplayに影響しない。

## 25. Collection

既存read-only ownershipだけを利用する。unlock、capture、reward、save mutationをgameから行わない。

## 26. Audio / Motion

MVPは新しい音を鳴らさないため常にsilent-safe。既存AudioManagerを直接importせず、mute/save境界を侵さない。lane movementとhit feedbackはCSS/Host update表示のみで、`prefers-reduced-motion`でも機能を維持する。

## 27. Accessibility

44 CSS px以上の操作、keyboard/pointer/touch、focus-visible、色以外のselected markerとthreat文字、aria-live feedback、composition-safe IME、pause表示、画像fallbackを必須とする。

## 28. Responsive UI

danger lanesを最上位、次にtarget/input、HUD、Companionの順にする。390×844、844×390、desktopで横overflowを出さず、visual viewport縮小時はboardを短くしてinputを同時に見せる。

## 29. Result

game-local resultに`outcome`, `score`, `correct`, `incorrect`, `wrongAttempts`, `maxCombo`, `life`, `encountersStarted`, `resolved`, `strongWords`, `weakWords`, `wordsPracticed`を持つ。共通Result wrapperは作らない。

## 30. Replay / Back

ReplayはHostの新session identityでcontentとMonster順を再生成する。BackはView input停止 → Core exit → Companion dispose → listener/View/DOM cleanupという既存Host順序を使う。

## 31. Difficulty Separation

LearningはGrade/content/accepted reading、Mechanicalはspeed/spawn gap/max active/graceで調整する。MVP UIに統合sliderを置かず、game-local rulesとして分離する。

## 32. Content QA

repo Grade 4データ202件は自動承認しない。重複、読み、語の自然さ、対象学年、曖昧性、表記、意味を人手reviewする。詳細は`YOMITABI_KANJI_DEFENSE_CONTENT_SPEC.md`。

## 33. Technical Architecture

Definition/Instance/ViewはContract v1 exact shape。Coreはauthoritative、Viewはsnapshot renderer/command producer。Host、LearningEvent envelope、Companion、Collection、main RAFを変更しない。

## 34. File Plan

`src/minigames/kanjiDefense/kanjiDefenseGame.js`, `kanjiDefenseContent.js`, `kanjiDefenseView.js`。registryとtitleに1 entryを追加し、専用test/report/docsを加える。

## 35. Test Plan

Core、lifecycle、scopeの3群。content integrity、determinism、movement、3 acts、retry/event uniqueness、escape/life、pause、identity、observer isolation、IME、responsive source、cleanup、Storage isolationを保護する。

## 36. Browser Certification

Production releaseにはreal browserでdesktop、390×844、844×390、IME、touch、keyboard、pause/visibility、3体、overflow、44px、reduced motion、image failure、replay/Back、runtime/network/scheduler/performanceを確認する。DOM testをBrowser PASSとは呼ばない。

## 37. Performance

active entity最大3、session contentを開始前に選択し、per-frameはactive MonsterだけのO(3)。新RAF/intervalなし。明白なframe drop、DOM増殖、listener leakをrelease blockerとする。

## 38. Production Acceptance Criteria

rule理解median ≤30秒、初回完走≥80%、replay intent≥60%、80%以上が漢字読み練習と説明、正答率55〜85%、critical content/browser/accessibility defect 0。

## 39. Playtest Plan

小学4〜6年生9〜12人。初target時間、IME、target切替、完走、誤答後理解、frustration、replay、翌日の語の想起を観察する。MVP実装PASSは子どもによる合格を代替しない。

## 40. Kill Criteria

2 iteration後もreplay intent<50%、理解median>45秒、typing/target frictionが学習を上回る、accuracyがpressureで崩壊、typing gameと認識、またはcontent QAが継続不能ならpivot/stopする。

## 41. Risks

IME速度差、small-screen keyboard、複数reading、Monster画像の視認性、live action中のfeedback、既存title過密が主要risk。速度bonusを外し、1 retry、text threat、fallback、bounded entitiesで軽減する。

## 42. MVP Scope

3 lanes、最大3 Monsters、最大12 encounters、Grade 4 golden pack、かな入力、retry、escape、life、combo、score、Companion、pause、Back、Replay、result、responsive/accessibility。persistent rewards、XP、rank、daily、online、multiplayer、dashboard、adaptive AI、boss HP、Collection mutation、network content、Contract v2は対象外。

## 43. Post-MVP Upgrades

review済み60語、tuning、optional kana tiles、platform-owned reward handoff、audio hook、boss variationはplaytest後に判断する。共通lane engineや新Contractを先回りして作らない。

## 44. Decision

- A Math Invader直接upgrade: **NO**。
- B 新`kanjiDefense`: **YES**。probe/history、rollback、testを隔離する。
- C LearningEvent 4 types: **YES**。
- D retry: **YES**。途中誤答をgame-local、terminal outcomeを一度だけ通知する。
- E escape: **YES**。`incorrect` + game-local reason。
- F Host変更0: **YES**（registry/title integrationのみ）。
- G persistent rewardなしのMVP価値: **YES**。reading-action、priority、combo、三幕でplaytest価値がある。

`KANJI DEFENSE PRODUCTION SPEC FROZEN`
