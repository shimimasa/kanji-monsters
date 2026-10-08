# 四国・九州ボーナス背景画像（2026-10-08）

- 制作: 組み込みの画像生成ツール。既存の地域背景とボーナス背景を画素調・構図の参照画像として使用。
- 配置: `public/assets/images/backgrounds/shikoku_bonus_area.webp`（51,378バイト）と `kyushu_bonus_area.webp`（44,308バイト）。生成PNGを最近傍で512×341へ縮小し、WebP品質82に変換。
- 用途: 四国・九州のボーナスステージ背景。地理教材の図版としては使用しない。

## 四国のプロンプト

> Use case: stylized-concept. Asset type: new 3:2 landscape background for the Shikoku bonus battle in a Japanese elementary-school kanji game, intended to display at 512×341 pixels. Input images are STYLE references only: match their crisp handcrafted 2D pixel-art clusters, rich but readable colors, strong layered depth and side-view battle backdrop composition; do not copy their buildings or exact composition. Scene: a welcoming Shikoku mountain pilgrimage path leading toward a small traditional temple gate among cedar-covered hills, with a glimpse of the Seto Inland Sea beyond. Fresh golden morning light, a quiet celebratory sense of reaching a journey milestone. Keep the central lower half spacious and relatively low contrast so game characters and text can sit in front. Clean continuous ground along the bottom edge. No people, creatures, monsters, text, signs, logos, UI, dramatic danger, or photo/3D appearance. No blurry watercolor: crisp pixel art with visible pixel clusters.

参照画像: `Kinki_bonus_area.webp`、`shikoku_area4.webp`。

## 九州のプロンプト

> Use case: stylized-concept. Asset type: new 3:2 landscape background for the Kyushu bonus battle in a Japanese elementary-school kanji game, intended to display at 512×341 pixels. Input images are STYLE references only: match their crisp handcrafted 2D pixel-art clusters, clear layered depth, saturated but readable colors and side-view battle backdrop composition. Make a NEW Kyushu scene, not a copy. Scene: the broad green Aso caldera grassland with a rounded volcanic mountain in the distance releasing only a thin peaceful curl of white steam, warm sunlit clouds, a few Kyushu azaleas and volcanic stones at the sides. A quiet celebratory final-journey feel, no erupting lava or threatening weather. Keep the central lower half spacious and relatively low contrast so game characters and text can sit in front; a continuous open ground plane across the bottom edge. No people, creatures, monsters, text, signs, logos, UI, photo or 3D appearance. No blurry watercolor: crisp pixel art with visible pixel clusters.

参照画像: `Hokkaido_bonus_area.webp`、`kyushu_area8.webp`。
