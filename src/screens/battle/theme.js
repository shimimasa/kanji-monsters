// src/screens/battle/theme.js
// バトル画面のUI定数・調整値（refactoring-plan Phase 5-1: 定数の抽出、挙動変化なし）
// battleScreen.js 分割の最初のステップ。今後 engine/renderer/effects/input をここに並べていく。

// 敵の登場順による枠スタイルの区分け
export const ENEMY_FRAME_CONFIG = {
  normal: { min: 1, max: 6 },    // 1-6体目
  elite: { min: 7, max: 9 },     // 7-9体目
  boss: { min: 10, max: Infinity } // 10体目以降
};

// 直近に出題された問題を避けるための設定値
export const RECENT_QUESTIONS_BUFFER_SIZE = 5; // 直近5問は出題しない

// 画面上のボタン矩形（label/位置は実行時に調整されるものもある）
export const BTN = {
  back:   { x: 20,  y: 20,  w: 100, h: 30,  label: 'タイトルへ' },
  stage:  { x: 40,  y: 20,  w: 120, h: 36,  label: 'もどる' }, // ← 名称・サイズ更新
  practice: { x: 20, y: 64, w: 120, h: 32,  label: 'れんしゅうへ' }, // バトルが怖いときの1タップ避難先
  attack: { x: 230, y: 380, w: 110, h: 50,  label: 'こうげき' },
  heal:   { x: 350, y: 380, w: 110, h: 50,  label: 'かいふく' },
  hint:   { x: 470, y: 380, w: 110, h: 50,  label: 'ヒント' },
};

// 演出の長さ（フレーム数）
export const ENEMY_DAMAGE_ANIM_DURATION = 30; // 約0.5秒（攻撃ヒット演出: 400〜600ms）
export const ENEMY_ATTACK_ANIM_DURATION = 45; // 約0.75秒（敵の突進/被ダメ: 600〜800ms）
export const ENEMY_DEFEAT_ANIM_DURATION = 60; // 約1.0秒（撃破演出: 800〜1000ms）
export const PLAYER_HP_ANIM_SPEED = 2;

// 高頻度ログを抑制するトグル
export const DEBUG = false;
