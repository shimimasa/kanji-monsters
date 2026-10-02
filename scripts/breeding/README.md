# はいごう（配合）のレシピ

`node --experimental-default-type=module scripts/breeding/gen-recipes.mjs`（リポジトリの一番上で）で
`src/minigames/breedingRecipes.js` を作りなおす。`breedingRecipes.js` は手で直さない。

- レシピ：「伝説の地方の タイプAの ゴトモン（Lv5以上）＋ どこかの タイプBの ゴトモン（Lv5以上）」。
- A は、その地方に ふつうの子が3ひき以上いるタイプだけ（多い順）。B は でんせつ→たべもの→しぜん→まつり→れきし→ものづくり の順。
- 1つの地方の10ぴきに、(B, A) の順で ちがう組を ならべて わりあてる（データの ならび順）。
- タイプ分け（`gotomonTypes.js`）や データが かわると レシピも かわるので、作りなおしたら テスト
  `tests/gotomon-minigames/gotomon-breeding.test.mjs` を まわす。すでに会えた伝説は 保存に残るので なくならない。
