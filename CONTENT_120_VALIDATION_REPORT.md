# Content 120 Validation

## 結果

7正本すべて120 canonical items。共有計算を2ゲームに複製して数えていない。`node --experimental-default-type=module scripts/validate-content-120.mjs all` PASS。

| Bank | Baseline | Final | 保持・修正 |
| --- | ---: | ---: | --- |
| Math | 81表示式 / 65概念 | 120概念 / 136表示式 | 旧81式すべて抽選可能 |
| English | 20 | 120 | 旧20レコード完全保持 |
| Sentence | 20 | 120 | 全旧fixture ID保持。19文改稿、1文は本文保持・区切り変更 |
| Timed | 20 | 120 | 旧20レコード完全保持 |
| Multi | 20 | 120 | 四季4問だけ問いの範囲を限定。素材・正答集合は保持 |
| Async | 20 | 120 | oxygenの問いだけ承認済み改稿 |
| Defense | 21使用 / golden24 | 120使用 | 旧golden24と旧使用21を完全保持。除外3は復帰なし |

## Math canonical rule

加算は `addition:min(a,b):max(a,b)` を1教材とする。3+5と5+3は同じ教材の表示バリエーション。減算は順序付き `subtraction:a:b`。旧81式に含まれる16組の左右交換を別教材として加算しない。

旧加算20概念＋旧減算45概念に、新加算40概念＋新減算15概念を追加。計120概念、表示可能な式は136。旧81表示式の保持を全列挙し、1200セッションの実samplerで全種類・全表示順の到達を確認。全120概念と各variantの正答を再計算。

範囲：加算 `a>=1,b>=1,a+b<=20`、減算 `1<=a<=20,1<=b<=20,a-b>=0`。掛け算・割り算・小数・分数を共有計算bankへ追加していない。1プレイ10問（加算5・減算5）を保持。旧問題のwithin-9 skillIdも保持し、新範囲だけwithin-20。両ゲームのCore受信をテスト。

## 静的検査

- 全件数、ID、正規化したcanonical text、空文字、undefined/null、schema、正答参照を検査。
- 選択肢内のID・表示テキスト重複、正答が実選択肢に含まれることを検査。
- 記号自体を学ぶ句点・読点の選択肢はNFKC＋空白正規化のみ。句読点を消して「。」「、」を同一回答とする誤った検査を避ける。
- 英語は全120の訳を区別し、毎問「正答＋同カテゴリ誤答2＋別カテゴリ誤答1」を検査。runtimeで実生成した4択を確認。
- 文ならべは3〜6ピース、ID・correctOrder・initialOrderの完全性を検査。意味上の唯一解は別の編集監査で判断する。
- タイムことばは全120語が漢字2字、読み3〜5字。読みの重複なし。
- 複数選択は全120問が5択中3正解。各問32通りの部分集合すべてで既存部分点式を再計算（3840組）。素材ID＝choiceIdの参照整合を確認。
- 防衛は正規化した許容読み、4年生漢字IDの実在と問題語中の対応文字、除外ID、全120のロード・抽選を確認。
- 文字数上限は表示確認の一次ゲート。最終判断には実Core/Viewの390×844画面を使用。

## 段階検査

| Bank | 実施した件数ゲート |
| --- | --- |
| Math | 旧81表示式/65概念の監査 → 80 → 100 → 120概念 |
| English / Sentence / Timed / Multi / Async | 旧20の監査 → 40 → 60 → 80 → 100 → 120 |
| Defense | 旧21の監査 → 40（新19） → 60 → 80 → 100 → 120 |

生成後に別解・語義・読みを再点検して修正。timed「午後」は読み2字としてゲートが拒否し「夕方」に代替。文ならべの60件再検査を80件追加後に呼んだ一回は件数不一致で拒否し、その後80件全体を再検査した。成功した記録は `artifacts/content-120/gates.jsonl`、最終全件結果は再現コマンドで確認できる。最終bankを一度に作成して後から段階投入と称していない。

## 回帰の期待値更新

| 対象 | Before | After | 理由 |
| --- | --- | --- | --- |
| Math operand/answer boundary | 9以内 | 承認された20以内 | 教材範囲の変更 |
| 定数RNGの消費回数 | 88 | 132 | 120概念のshuffle＋旧表示順の抽選。停止性・不正乱数拒否を維持 |
| 各fixture件数 | 20 | 120 | 教材追加のみ |
| Defense使用bank/version | 21 / pre-reviewed-v1 | 120 / content-120-v1 | 新99問を人間の旧認証済みと偽称しない |
| Defense回答lookup | golden24 | 実使用120 | 新規IDでも既存のCore/lifecycleテストを実行するため |
| Defense Content byte境界 | 旧Content全体固定 | 旧golden/使用21固定＋新99検証 | 意図的Content認証境界変更。Core/View固定は維持 |

テスト削除なし。現行回帰は過去checkpoint専用 `scope.test.mjs` を除き、現在の漢字防衛隊再認証scopeを含む既存648件に教材テスト21件を追加し、`--test-concurrency=1` で669 PASS / 0 FAIL。防衛単独59 PASS / 0 FAIL。過去scopeは当時のbyte固定を証明する履歴テストとして保持し、承認済みContent変更に合わせて遡及改変していない。

## Candidate不変

tagとrelease branchは双方 `a9cb2b294e68229b31805a46666d2249ff273ac3`。作業は `feature/content-bank-120`。ゲームCore/View、XP、Lv、ランク、技、save、音、ロガーの変更なし。`git diff --check` PASS（改行形式の警告はあり）。
