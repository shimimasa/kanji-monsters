# 進化の絵（Codex で作る）

`targets.json` に 1ぴきずつ `id` と `style`（方向）を書く。方向は その子の性格に合わせて 1つ：
`cute`（かわいさ）・`cool`（かっこよさ）・`eerie`（ちょっと ぶきみ。こわすぎない）・`noble`（りっぱ。実在の人物・神さま・仏像・文化財・民族の衣装が もとの子に。敬意をもって、悪者ふう・こわい顔に しない）。からだの変え方は書かない
（Codex が しょうかい文と元の絵から考える）。方向ごとの ことばは `run-codex.mjs` の `STYLES`、共通の指示は `prompt.tpl.txt`。

1. 指示文の確認（Codex は呼ばない）
   `node --experimental-default-type=module scripts/evolution/run-codex.mjs C:/kanji-evo/<回> --dry`
2. Codex に作らせる（1ぴき1回の `codex exec`、元の絵を添付。4本同時、`--jobs=N` で かえられる。1ぴき 2〜5分）
   `node --experimental-default-type=module scripts/evolution/run-codex.mjs C:/kanji-evo/<回>`（できたものは とばすので、とちゅうから再開できる）
   1ぴきだけ やりなおすときは その id の フォルダを消して `... C:/kanji-evo/<回> <id>`。新しい回は 新しいフォルダに。
   Codex の答えは `<回>/<id>/codex.log`。
3. 目で確かめる（元の絵と並べた シート）
   `python scripts/evolution/compare.py C:/kanji-evo/<回> <シート.png> <id> ...`
4. ゲームに入れる（背景が透明か確かめ、元の絵に そろえる：枠に しめる大きさ＝元の1.05倍・明るさ＝元と同じ・48色・lossy WebP。512x512 で `public/assets/images/monsters/evo/<id>.webp`、`evolvedIds.js` を作りなおす）
   `python scripts/evolution/import-images.py C:/kanji-evo/<回>`（入れかえるときは `--force`）

Claude からは 2. の形の コマンドだけ 許可してある（`.claude/settings.local.json`）。パイプや `cd` を つけると 許可の形から外れる。
