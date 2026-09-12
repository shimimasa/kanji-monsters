# 漢字防衛隊：Browser Tester向け説明（1ページ版）

## 目的

実ブラウザー・実IME・mobile相当layoutで、子どものplaytestを歪める操作不能やruntime問題がないか確認します。教材の正しさは判定しません。詳細な記録欄は[Browser QA Handoff](./YOMITABI_KANJI_DEFENSE_BROWSER_QA_HANDOFF.md)を使ってください。

## 起動

```text
1. repositoryで git rev-parse HEAD と git status --short を記録
2. npm run build
3. npm run preview -- --host 127.0.0.1
4. 表示されたlocal URLを実ブラウザーで開く
5. Titleの「旗艦ゲーム：漢字防衛隊」を選ぶ
```

別端末から接続する場合は、組織の安全なlocal-network手順に従い、使用URLを記録してください。production deployや外部公開は不要です。

## 必須環境

- Desktop 1280 × 720以上
- Mobile portrait 390 × 844
- Mobile landscape 844 × 390
- 実Japanese IME
- soft keyboardを表示できるmobile実端末または妥当なdevice environment

## Smoke steps

Title → 起動 → Monster選択 → かな入力 → correct → first wrong → hint/retry → retry correct → second wrong → escape/life減少 → 2体 → 3体 → combo → result → Replay → Backを通してください。

特に確認すること:

- composition中Enterでsubmitされない。確定後Enterは一回だけsubmitする。
- target切替、focus loss、pause、Back中のIME callbackがold targetへ送られない。
- soft keyboard中もinput、selected Monster、threatが分かる。
- 主要controlはcomputed width/heightとも44 CSS px以上。
- 390 × 844 / 844 × 390でdocument/body/root/boardに操作を妨げる横overflowがない。
- 3体時もlane、prompt、selected marker、danger、HUDを区別できる。
- pause/hidden tab中に進まず、復帰時にcatch-up全滅しない。
- reduced motionとimage failureでも操作できる。
- console crash/unhandled rejection、unexpected external request、追加schedulerがない。
- 同一tabでenter/Back/Replayを10 cycle行い、二重入力や劣化がない。

## 必須screenshots

first Monster、first wrong/retry、3体pressure、portrait soft keyboard、landscape、resultの6場面。ファイル名は`browser-<browser>-<viewport>-<scenario>-<date>.png`。

## BLOCKER

IME double submit、soft keyboardで操作不能、target選択不能、control欠落overflow、pause中movement/input、duplicate completion、runtime crash/unhandled rejection、顕著なlag、44px未満により主要操作困難、Back/Replay cleanup failureはBLOCKERです。

## 報告

各issueにviewport、browser/OS、手順、expected、actual、severity、screenshot、console、再現率を付けます。全required caseを`PASS / MINOR / BLOCKER / NOT RUN`で記録し、最後に`PASS / CONDITIONAL PASS / FAIL`を選んでください。

未知・未実施をPASSにしないでください。CONDITIONAL PASSはchild testを歪めないminorだけに使い、理由とownerを残します。

`BROWSER QA HANDOFF READY`
