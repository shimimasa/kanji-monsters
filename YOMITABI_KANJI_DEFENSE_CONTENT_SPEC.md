# YOMITABI 漢字防衛隊 Content Spec

Date: 2026-09-12

## Limited UX playtest overlay

Formal release content remains the 24-item golden pack and still requires Human Content Review. For the narrower exploratory UX pilot only, runtime selection uses content version `kanji-defense-limited-ux-playtest-pre-reviewed-v1`: the 21 `APPROVE (PRE)` items, excluding `以下` (`kd-g4-003`)、`位置` (`kd-g4-004`)、`結果` (`kd-g4-011`)。Each session samples 12 unique items from this pool. This pool is **PRE-REVIEWED**, not certified content, and cannot support curriculum、learning-effect or public-release claims.

## Target grade and source audit

MVPは小学4年配当漢字を少なくとも1字含む語を対象とする。source auditは`public/data/kanji_g4_proto.json`を基準にした。現在202 records、ID重複0、漢字重複0、reading欠落0、meaning欠落1、空readingを含むrecords 2、単一reading 61、複数reading 141である。したがって全件自動出題は禁止する。

## Prompt schema

```js
{
  fixtureId,
  prompt,
  acceptedReadings: [hiragana],
  focusKanjiIds: [grade4SourceId],
  skillId,
  meaning,
  hint
}
```

`prompt`とidentityを分離する。`acceptedReadings`は空でなく重複なし、ひらがなへnormalize後も一意。`focusKanjiIds`はcurrent Grade 4 sourceに存在し、配列を含め全てimmutableにする。

## Eligibility rules

- Grade 4漢字を1字以上含む一般的な語。
- 他の漢字は原則Grade 1〜4。例外はeditorial justificationが必要。
- 文脈なしでもreadingが一意、または妥当な全readingを列挙できる。
- かな表記を含め12文字以内、readingは16文字以内。
- 小学4〜6年生に自然で、意味を一文で説明できる。
- source ID、reading、意味を二者確認できる。

## Exclusion rules

固有名詞依存、熟字訓や人名地名だけの特殊reading、archaic/offensive表現、文脈でreadingが変わる語、空reading、欠落meaning、不自然な機械生成文、重複、表記揺れ未解決、学年負荷過大を除外する。

## Input and accepted readings

NFKC、trim、空白除去、カタカナ→ひらがなだけをnormalizeする。送り仮名を含む語は送り仮名まで入力する。音便、長音、歴史的仮名遣いを推測採点せず、必要なvariantはreview後に明示追加する。

## Initial golden pack

初期実装は次の24語。コード実装と自動testを通すためのgolden subsetであり、教育編集者によるrelease certificationは別途必要。

| Prompt | Reading | Grade 4 source |
| --- | --- | --- |
| 愛犬 | あいけん | g4-001 |
| 案内 | あんない | g4-002 |
| 以下 | いか | g4-003 |
| 位置 | いち | g4-005, g4-134 |
| 印刷 | いんさつ | g4-007, g4-078 |
| 英語 | えいご | g4-008 |
| 栄養 | えいよう | g4-009, g4-187 |
| 塩分 | えんぶん | g4-011 |
| 一億 | いちおく | g4-013 |
| 加入 | かにゅう | g4-014 |
| 結果 | けっか | g4-059, g4-015 |
| 貨物 | かもつ | g4-016 |
| 課題 | かだい | g4-017 |
| 改良 | かいりょう | g4-020, g4-191 |
| 機械 | きかい | g4-038, g4-021 |
| 害虫 | がいちゅう | g4-022 |
| 街灯 | がいとう | g4-023, g4-145 |
| 各地 | かくち | g4-024 |
| 覚える | おぼえる | g4-025 |
| 完成 | かんせい | g4-027, g4-109 |
| 関係 | かんけい | g4-030 |
| 観察 | かんさつ | g4-031, g4-079 |
| 希望 | きぼう | g4-034, g4-177 |
| 季節 | きせつ | g4-035, g4-116 |

## Monster/regional pack

中部地方の既存12体を使用し、promptと地域事実を無理に結び付けない。背景・Monster・wave名によるLevel 2 contextとする。画像は既存`grade4-chuubu` assetsを参照し、欠落時もtext fallbackで継続する。

## QA flow

1. schema/static validation。
2. source ID存在とGrade 4照合。
3. 国語教材担当によるreading/meaning/学年/自然さreview。
4. 別reviewerによるblind answer確認。
5. UIで文字切れ、IME、同音、hint確認。
6. 子どもplaytestで未知語率と誤答理由を記録。
7. approved/version/reviewer/dateを将来のcontent manifestに記録。

## 60-item MVP plan

golden 24に36語を追加する。各中部areaへ6〜7語を割り当てるのではなく、学習順と語の自然さを優先する。candidate抽出 → 90語longlist → ambiguity/grade filterで72語 → double editorial reviewで60語を承認する。最低構成は、熟語44、送り仮名語8、複数accepted readingを実証する安全な語4、補欠4。コードへ入れる前に全60語を同一fixture testへ通す。

## Certification state

Schema/source integrity: **AUTOMATED PASS対象**。語彙の教育的妥当性: **CONTENT CERTIFICATION PENDING**。既存datasetをsource of truthとして参照したが、既存内容そのものを無条件に認証していない。
