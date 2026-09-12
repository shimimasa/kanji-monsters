# YOMITABI 漢字防衛隊 Human Content Review Pack

Status: **HUMAN REVIEW REQUIRED — AI PRE-REVIEW IS NOT CERTIFICATION**
Content version: Golden Pack 24 / repository state at 2026-09-12

## 1. Review record

```text
Reviewer name / ID:
Role / qualification:
Organization (optional):
Review date:
Content version / commit:
Review round: A correctness / B blind ambiguity
Second reviewer required: yes / no
Signature or approval record:
```

想定reviewerは小学校国語に詳しい教員、国語教材編集経験者、または漢字指導経験者の少なくとも1名。理想はReviewer Aが内容の正確性を確認し、Reviewer Bが答えを伏せた状態でreading/ambiguityを確認する。

## 2. What this review certifies

これは単に「漢字を読めるか」を確認するreviewではない。各itemについて以下を確認する。

1. Accepted Readingは標準的か。別の妥当readingを漏らしていないか。
2. 小4〜6へ提示可能か。focus以外の漢字負荷が高すぎないか。
3. 子どもが実際に見る自然な語か。
4. 文脈なしでも一意に採点できるか。
5. Meaningは短く、正確で、循環説明でないか。
6. Hintは役立つが答えを出しすぎないか。
7. 固有名詞・地域差・不適切表現等のchild suitability問題がないか。

Decisionは`APPROVE`、`REVISE`、`REMOVE`、`NEEDS SECOND REVIEW`のいずれかを必ず選ぶ。空欄は未認証である。

## 3. Required item review — all 24 items

Runtimeのfirst-wrong hintは基本的に「先頭かな…（reading文字数）」である。下表のMeaning/Hintは現在の製品sourceそのままで、提案文ではない。

| Prompt | Accepted Reading | Focus Kanji | Meaning | Hint | Grade Fit | Naturalness | Ambiguity | Reviewer Decision | Comment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 愛犬 | あいけん | 愛 `g4-001` | かわいがっている犬 | 大切にしている犬 / `あ…（4文字）` | | | | | |
| 案内 | あんない | 案 `g4-002` | 道や場所を知らせること | 道を知らせる / `あ…（4文字）` | | | | | |
| **以下** | いか | 以 `g4-003` | **その数をふくんで下** | その数から下 / **`い…（2文字）`** | | | | **PRE-REVIEW: REVISE** | meaning不完全、短reading hint要判断 |
| **位置** | いち | 位 `g4-005`、置 `g4-134` | ものがある場所 | ものの場所 / **`い…（2文字）`** | | | | **PRE-REVIEW: REVISE** | 短reading hint要判断 |
| 印刷 | いんさつ | 印 `g4-007`、刷 `g4-078` | 文字や絵を紙にうつすこと | 紙にうつす / `い…（4文字）` | | | | | |
| 英語 | えいご | 英 `g4-008` | イギリスやアメリカなどで使う言葉 | 外国の言葉 / `え…（3文字）` | | | | | 地域表現の簡略化も確認 |
| 栄養 | えいよう | 栄 `g4-009`、養 `g4-187` | 体を育て、動かすもと | 体を育てるもと / `え…（4文字）` | | | | | |
| 塩分 | えんぶん | 塩 `g4-011` | 食べ物などにふくまれる塩の量 | 塩の量 / `え…（4文字）` | | | | | |
| 一億 | いちおく | 億 `g4-013` | 一万を一万倍した数 | 大きな数 / `い…（4文字）` | | | | | |
| 加入 | かにゅう | 加 `g4-014` | 仲間や会に入ること | 仲間に入る / `か…（4文字）` | | | | | |
| **結果** | けっか | 結 `g4-059`、果 `g4-015` | **行ったことのあとに出たもの** | **行ったあとの答え** / `け…（3文字）` | | | | **PRE-REVIEW: REVISE** | meaning/hintの範囲が曖昧 |
| 貨物 | かもつ | 貨 `g4-016` | 運ばれる荷物 | 運ぶ荷物 / `か…（3文字）` | | | | | |
| 課題 | かだい | 課 `g4-017` | 取り組むべき問題 | 取り組む問題 / `か…（3文字）` | | | | | |
| 改良 | かいりょう | 改 `g4-020`、良 `g4-191` | よりよいものに直すこと | よく直す / `か…（5文字）` | | | | | |
| 機械 | きかい | 機 `g4-038`、械 `g4-021` | 力を使って仕事をするしくみ | 仕事をするしくみ / `き…（3文字）` | | | | | |
| 害虫 | がいちゅう | 害 `g4-022` | 人や作物に害をあたえる虫 | 作物をこまらせる虫 / `が…（5文字）` | | | | | |
| 街灯 | がいとう | 街 `g4-023`、灯 `g4-145` | 道を明るくする灯り | 道の灯り / `が…（4文字）` | | | | | |
| 各地 | かくち | 各 `g4-024` | それぞれの場所 | いろいろな場所 / `か…（3文字）` | | | | | |
| 覚える | おぼえる | 覚 `g4-025` | 忘れないように身につける | 心にのこす / `お…（4文字）` | | | | | 送り仮名と`覚める`との区別を確認 |
| 完成 | かんせい | 完 `g4-027`、成 `g4-109` | すっかりできあがること | できあがる / `か…（4文字）` | | | | | |
| 関係 | かんけい | 関 `g4-030` | ものごとのつながり | つながり / `か…（4文字）` | | | | | |
| 観察 | かんさつ | 観 `g4-031`、察 `g4-079` | よく見て変化や様子を調べること | よく見て調べる / `か…（4文字）` | | | | | |
| 希望 | きぼう | 希 `g4-034`、望 `g4-177` | こうなってほしいという願い | 未来への願い / `き…（3文字）` | | | | | |
| 季節 | きせつ | 季 `g4-035`、節 `g4-116` | 春夏秋冬のそれぞれの時期 | 春・夏・秋・冬 / `き…（3文字）` | | | | | |

## 4. Mandatory review questions per item

各rowのCommentまたは別紙に次を回答する。

- Reading: 標準的な読みか。
- Accepted variants: 同じ表記に別の妥当readingがあるか。ある場合は文脈なし採点が可能か。
- Grade: 小4〜6へ提示してよいか。
- Other Kanji load: Grade 4以外の字がfocus学習を妨げないか。
- Naturalness: 子どもが日常・学校・読書で見る自然な語か。
- Ambiguity: promptだけでreadingを一意に判断できるか。
- Meaning: 短く正確でchild-readableか。
- Hint: 答えを出しすぎず再回答に役立つか。
- Tone: 年齢相応で、不快・攻撃的・恥を煽る表現がないか。

## 5. Highlighted REVISE items

### 以下

現meaning「その数をふくんで下」は文として不完全。完全な説明へ修正する必要がある。readingが2文字のため`い…（2文字）`は答えの半分を直接示す。

### 位置

Meaning自体は明確だが、`い…（2文字）`が答えの半分を示す。短reading hint policy確定までAPPROVEしない。

### 結果

Meaning「行ったことのあとに出たもの」は曖昧で、Hint「行ったあとの答え」は意味を狭めすぎる。短く正確なoutcome説明へ直す。

## 6. Required two-character hint policy decision

Reviewerは次の一つを推奨し、理由を残す。これは製品変更の指示ではなく、修正担当への教材判断である。

| Option | Policy | Recommendation / reason |
| --- | --- | --- |
| A | 2文字readingではfirst kanaを出さない | |
| B | 文字数だけ表示する | |
| C | Meaningを使う等、別hintへ置き換える | |
| D | 2文字readingを初回playtest packから除外する | |

```text
Selected policy:
Reviewer:
Date:
Reason:
Second review required:
```

## 7. Approval threshold

Child playtestへ進むには、同一content versionで少なくとも**16 itemsが人間reviewerによりAPPROVE**されていること。12 encountersを重複なしで抽出する余裕を確保する。`APPROVE (PRE)`や空欄は数えない。REVISE後のitemは修正文を再reviewして初めてAPPROVEになる。

推奨review level:

1. Reviewer A: reading、grade、meaning、hint、child suitabilityを確認。
2. Reviewer B: Accepted Readingを見ずにpromptを読み、ambiguity/variantをblind確認。

## 8. Per-item evidence format

```text
Prompt:
Fixture / content version:
Reviewer:
Role:
Date:
Accepted Reading reviewed:
Other valid readings:
Decision: APPROVE / REVISE / REMOVE / NEEDS SECOND REVIEW
Reason:
Suggested revision:
Second review needed: yes / no
Final approver / date:
```

## 9. Final content decision

```text
Content version / commit:
Reviewer A / date:
Reviewer B / date:
APPROVE count:
REVISE count:
REMOVE count:
NEEDS SECOND REVIEW count:
Two-character hint policy:
Approved child-test subset (16+ fixture IDs):
Open blockers:

CONTENT FINAL:
PASS / FAIL / INCOMPLETE

Rationale:
```

Runtime manifestへ将来`reviewStatus`、`reviewer`、`reviewDate`、`contentVersion`を持たせる案はPROVISIONAL recommendationであり、このhandoffではschemaやcodeを変更しない。承認記録は当面このreview packまたはrelease recordに残す。

`HUMAN CONTENT REVIEW PACK READY`

`EDITORIAL HUMAN REVIEW STILL REQUIRED`
