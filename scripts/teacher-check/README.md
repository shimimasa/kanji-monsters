# 先生チェックのページ

子どもに見せている文や答えを、先生が「OK／直す」で確かめるページ（claude.ai の Artifact）。

- ページ: https://claude.ai/artifact/5tphzMULn1LQVwUqR7cEMX （持ち主だけが開ける。共有は claude.ai の Share から）
- 中身（916件）: 例文の読み 603（`docs/photo-rally-reading-check.csv`）・ことわざの分け方 90（`PROVERB_SPLITS` と `proverbTarget`）・
  漢字パーツ 49（`docs/kanji-parts-check.csv`）・宅配便のヒント 174（`docs/delivery-hints-check.csv`）
- 印の保存先: そのページの db、コレクション `checks`。ドキュメントIDは項目のID
  （`r-001`… 例文＝CSVの行の順、`p-01`… ことわざ＝`PROVERB_CASES` の順、`k-01`… パーツ、`h-001`… ヒント）。
  中身は `{ kind, verdict: "ok" | "fix", note（正しい形）, label, at }`。Claude は `ArtifactData` の list で読む。
- 作り直し: `node scripts/teacher-check/gen.mjs` → `node scripts/teacher-check/build.cjs` → できた `teacher-check.html` を
  同じURLに publish（印は db にあるので消えない）。**CSVの行の順を変えるとIDがずれる**ので、直すときは行を足し引きせず中身だけ直す。
