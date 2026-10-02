# 進化の絵（Codex で作る）

まず ためしに10ぴき（`targets.json`：ジャガイモスライムと 各地方のボス9ひき）。

1. 指示文の確認（Codex は呼ばない）
   `node --experimental-default-type=module scripts/evolution/run-codex.mjs <作業フォルダ> --dry`
2. Codex に作らせる（1ぴきずつ `codex exec`、元の絵を添付、画像生成ツールで `<id>_evo.png` を保存）
   `node --experimental-default-type=module scripts/evolution/run-codex.mjs <作業フォルダ> HKD-E01`（1ぴきだけ）
   `node --experimental-default-type=module scripts/evolution/run-codex.mjs <作業フォルダ>`（のこり全部。できたものは とばす）
   Codex の答えは `<作業フォルダ>/<id>/codex.log`。
3. ゲームに入れる（背景が透明か確かめ、512x512 の WebP に そろえて `public/assets/images/monsters/evo/<id>.webp`）
   `python scripts/evolution/import-images.py <作業フォルダ>`（入れなおすときは `--force`）

背景が透明でない絵は とばして知らせる。顔が こわい・元のキャラに見えない絵は 2. を その id だけ もう一度。
