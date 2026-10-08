# 冒険先選択の地図画像（2026-10-08）

- 制作: 組み込みの画像生成ツール。既存地図を地形の参照画像として使用。
- 配置: `public/assets/images/stage.select/japan-adventure-map.webp`（136,900バイト）と `world-adventure-map.webp`（281,884バイト）。生成PNGを WebP 品質82に変換。
- 用途: 冒険先選択の札のみ。ほかの画面の地図と位置合わせをする画像は変更していない。
- 確認事項: 絵本調の地図なので、授業で地理資料として使う前に先生が海岸線や島の細部を確認する。

## 日本地図のプロンプト

> Use case: scientific-educational. Asset type: square map illustration for the Japan adventure card of a Japanese elementary-school kanji game. Input image: geographic reference for the Japanese archipelago; preserve the recognizable coastline, island positions and relative scale, including Hokkaido, Honshu, Shikoku, Kyushu and Okinawa. Primary request: redraw this map as a polished children's picture-book atlas. Soft turquoise sea, warm green land with restrained forest and mountain texture, cream coastline edging, a few subtle wave curls in the sea, gentle paper texture. Clear silhouette even when displayed at about 150 pixels high. Square composition with comfortable padding on all sides. No words, labels, flags, borders, characters, monsters, markers or interface elements. Avoid dark black areas, flat neon green and distorted or invented major islands.

## 世界地図のプロンプト

> Use case: scientific-educational. Asset type: wide world map illustration for the World adventure card of a Japanese elementary-school kanji game. Input image: geographic reference; preserve a recognizable Pacific-centered world map with Asia and Australia left of center, North and South America on the right, Europe and Africa at far left, and clear separation of the continents. Primary request: redraw as a polished children's picture-book atlas matching a watercolor Japan map: soft turquoise sea, warm green land, cream coastline edging, restrained forest/mountain textures and a few subtle wave curls, gentle paper texture. Landscape composition about 3:2 with generous sea margin. Clear land silhouettes when displayed at 300 pixels wide. No words, labels, flags, borders, characters, monsters, markers or UI. Avoid black ocean, flat neon green, invented major land masses and distorted continental positions.
