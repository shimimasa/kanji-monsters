// src/screens/battle/theme.js
import { getLearningControls } from '../../ui/learningControls.js';
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

// せまい画面（compact）のバトルの下側。左にHPパネル（x20〜280）を残し、
// こうげき・かいふく・ヒントと入力欄は右側（x300〜780）にまとめる。
// 共通の getLearningControls は横いっぱいに3つ並べるので、HPパネルとログを覆っていた。
export const COMPACT_BATTLE_AREA = { left: 300, right: 780, gap: 12 };

// 「1つまえの漢字」パネル（battleScreen.js が x20・y104・140×180 で描く）の下端
export const PREV_KANJI_PANEL_BOTTOM = 284;

export function layoutBattleButtons(canvas) {
  const controls = getLearningControls(canvas);
  for (const key of ['practice','attack','heal','hint']) Object.assign(BTN[key],controls[key]);
  Object.assign(BTN.stage,controls.back);
  const height = canvas?.height || 600;
  if (controls.compact) {
    const { left, right, gap } = COMPACT_BATTLE_AREA;
    const w = Math.floor((right - left - gap * 2) / 3);
    ['attack','heal','hint'].forEach((key, i) => Object.assign(BTN[key], { x: left + i * (w + gap), w }));
    // 「れんしゅうへ」は もどる の右。共通の配置（x520）だと敵の名前の札の裏に隠れていた
    Object.assign(BTN.practice, { x: BTN.stage.x + BTN.stage.w + 10, y: BTN.stage.y, w: 230 });
  } else {
    // 「れんしゅうへ」は 自分のHPパネル（下端から 150）の すぐ上。もどる の下（y76〜124）だと
    // 「1つまえの漢字」パネル（y104〜）に下半分が隠れていた
    Object.assign(BTN.practice, { x: 20, y: height - 150 - BTN.practice.h - 8, w: 120 });
  }
  return controls;
}

// 演出の長さ（ミリ秒）。端末のFPSに左右されない値にする。
export const ENEMY_DAMAGE_ANIM_DURATION = 500;
export const ENEMY_ATTACK_ANIM_DURATION = 750;
export const ENEMY_DEFEAT_ANIM_DURATION = 1000;
export const PLAYER_HP_ANIM_SPEED = 120; // HP/秒

// 高頻度ログを抑制するトグル
export const DEBUG = false;
