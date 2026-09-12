# 漢字防衛隊：教材レビュアー向け説明（1ページ版）

## ゲーム概要

「漢字防衛隊」は、小学4〜6年生が画面上の漢字・熟語を見て、かなで読みを入力する約3分のゲームです。間違えたときは一度だけhintを見て再回答できます。今回reviewするのは初期golden pack 24語です。

## あなたにお願いする仕事

コードやゲーム設計のreviewは不要です。[Human Content Review Pack](./YOMITABI_KANJI_DEFENSE_HUMAN_CONTENT_REVIEW_PACK.md)の24行すべてについて、次を確認してください。

1. 読みは標準的か。他にも正答にすべき読みがないか。
2. 小学4〜6年生へ文脈なしで提示してよい語か。
3. focus以外の漢字が難しすぎないか。
4. 子どもが学校・日常・読書で見る自然な語か。
5. 意味は短く、正確で、循環説明でないか。
6. hintは役立つが答えを出しすぎないか。
7. 地域差・固有名詞・不適切表現・曖昧さがないか。

## 判定方法

- `APPROVE`: 現在のreading / meaning / hintでchild testへ使える。
- `REVISE`: 文言、accepted reading、hint等を直して再reviewする。
- `REMOVE`: 文脈なし出題や対象年齢に適さず、今回packから外す。
- `NEEDS SECOND REVIEW`: 専門判断や別reviewerのblind確認が必要。

空欄やAIの`APPROVE (PRE)`は人間承認ではありません。判断理由を短くCommentへ記入し、reviewer、日付、content versionを残してください。

## 特に確認する3語

- `以下（いか）`: meaning「その数をふくんで下」が不完全。読み2文字に対する`い…（2文字）`も強すぎる。
- `位置（いち）`: 読み2文字に対する`い…（2文字）`が答えの半分を示す。
- `結果（けっか）`: meaningとhintが曖昧、または意味を狭めすぎている。

## 2文字readingのhint

次のどれを推奨するか選び、理由を書いてください。

- 先頭かなを出さない
- 文字数だけ出す
- Meaning等の別hintを使う
- 2文字readingを初回playtest packから外す

## 完了条件と提出

- 24語すべてにdecisionがある。
- 3 REVISE語の扱いと2文字hint policyが明確。
- 少なくとも16語が`APPROVE`ならchild-test subset候補をfixture IDで指定する。
- 記入済みpackをversionを変えずに返し、修正提案は原文と分けて残す。
- 理想は、別reviewerがAccepted Readingを見ずに最終subsetをblind-answerする。

不明な語を推測でAPPROVEせず、`NEEDS SECOND REVIEW`にしてください。

`HUMAN CONTENT REVIEW PACK READY`
