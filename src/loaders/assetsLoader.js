// assetsLoader.js
//
// ◆initAssets()         … ゲーム起動時に"共通 UI 画像"をプリロード
// ◆loadEnemyImage(id)   … 敵スプライトをステージ開始時にプリロード
// ◆images               … すべての Image オブジェクトをキャッシュ保持

export const images = {};                // key → HTMLImageElement

/* ------------------------------------------------------------------ */
/*  共通 UI 画像のプリロード                                           */
/* ------------------------------------------------------------------ */

const UI_IMAGE_PATHS = {
  logo:          '/assets/images/logo.png',
  buttonNormal:  '/assets/images/button_normal.png',
  buttonClick:   '/assets/images/button_click.png',
  buttonSelect:  '/assets/images/button_select.png',
  buttonInactive:'/assets/images/button_not_act.png',
  iconAttack:    '/assets/images/icon_attack.png',
  iconHeal:      '/assets/images/icon_heal.png',
  iconExp:       '/assets/images/icon_exp.png',
  iconHint:      '/assets/images/icon_hint.png',
  iconSetting:   '/assets/images/icon_setting.png',
  markerPref:    '/assets/images/stage.select/marker_pref.png',
  markerLocked:  '/assets/images/stage.select/marker_locked.png',
  markerCleared: '/assets/images/stage.select/marker_cleared.png',
  panelStone: '/assets/images/ui/panel_stone.png',
  buttonStoneNormal: '/assets/images/ui/button_stone_normal.png',
  buttonStoneHover: '/assets/images/ui/button_stone_hover.png',
  buttonStonePressed: '/assets/images/ui/button_stone_pressed.png',
  iconLogAttack: '/assets/images/ui/icon_log_attack.png',
  iconLogHeal: '/assets/images/ui/icon_log_heal.png',
  iconBookClosed: '/assets/images/ui/icon_book_closed.png',
  panelPlayer: '/assets/images/ui/panel_player.png',
  panelEnemy: '/assets/images/ui/panel_enemy.png',
  stageSelect0:  '/assets/images/stage.select/stage.select.png',
  stageSelect:   '/assets/images/stage.select/stage.select.png',
  stageSelect1:  '/assets/images/stage.select/stage.select.1.png',
  stageSelect2:  '/assets/images/stage.select/stage.select.2.png',
  stageSelect3:  '/assets/images/stage.select/stage.select.3.png',
  stageSelect4:  '/assets/images/stage.select/stage.select.4.png',
  stageSelect5:  '/assets/images/stage.select/stage.select.5.png',
  stageSelect6:  '/assets/images/stage.select/stage.select.6.png',
  stageSelect11:  '/assets/images/stage.select/stage.select.11.png',
  stageSelect12:  '/assets/images/stage.select/stage.select.12.png',
  // 地方選択画面用の画像を追加
  japanMap: '/assets/images/stage.select/日本地図.png',
  worldMap: '/assets/images/stage.select/世界地図.png',
  woodenSign:    '/assets/images/wooden_sign.png',
  regionMarker:  '/assets/images/region_marker.png',
  // タイトル画面用の背景画像を追加
  titleBackground: '/assets/images/title_background.png',

  
  // 世界ステージ選択用の画像を追加
  stageSelect7: '/assets/images/stage.select/stage.select7.png', // 4級
  stageSelect8: '/assets/images/stage.select/stage.select8.png', // 3級
  stageSelect9: '/assets/images/stage.select/stage.select9.png', // 準2級
  stageSelect10: '/assets/images/stage.select/stage.select10.png', // 2級
};

// L.73 付近の initAssets 関数を修正
export async function initAssets() {
  const tasks = Object.entries(UI_IMAGE_PATHS).map(([key, src]) => {
    // ↓↓↓ この条件式を修正します ↓↓↓
    const needsTransparency = ['panelStone', 'panelPlayer', 'panelEnemy','iconOnyomi', 'iconKunyomi'].includes(key);
    // ↑↑↑ 'key ==='とカンマ区切りだった部分を、配列とincludesメソッドを使った正しい判定に修正 ↑↑↑

    const loader = needsTransparency
      ? loadImageWithTransparency(src)
      : loadImage(src);

    return loader
      .then(img => { images[key] = img; })
      .catch(() => console.warn(`⚠️ ${src} の読み込み失敗`));
  });
  await Promise.all(tasks);
}

/* ------------------------------------------------------------------ */
/*  敵スプライトの動的ロード                                           */
/* ------------------------------------------------------------------ */

/**
 * 敵画像を読み込み、images[enemyImageName] にキャッシュ
 * @param {string} enemyImageName 例: "HKD-E01" または "HKD-E01.png" / "HKD-E01.webp"
 * @returns {Promise<HTMLImageElement|null>}
 */
export async function loadEnemyImage(enemyImageName) {
  // キャッシュ済なら即返却
  if (images[enemyImageName]) return images[enemyImageName];

  // 渡された名称に拡張子がなければ .png を付与
  let filename = enemyImageName;
  if (!/\.[^/.]+$/.test(enemyImageName)) {
    filename = `${enemyImageName}.png`;
  }
  const path = `/assets/images/enemy/${encodeURIComponent(filename)}`;
  try {
    const img = await loadImage(path);
    // キャッシュは拡張子なしキーでも良いように、オリジナルキーで保持
    images[enemyImageName] = img;
    return img;
  } catch {
    console.warn(`❌ 敵画像のロード失敗: ${path}`);
    return null;
  }
}

/**
 * ステージ背景画像を読み込む関数
 * @param {string} stageId ステージID
 * @returns {Promise<HTMLImageElement|null>}
 */
export async function loadBgImage(stageId) {
  // キャッシュ済みならそれを返す
  const cacheKey = `bg_${stageId}`;
  if (images[cacheKey]) return images[cacheKey];
  
  const timestamp = Date.now();

  // 補助: 表記ゆれ対応（kanto→kantou, chubu→chuubu, chugoku→cyuugoku, 世界系の頭大文字）
  const altSpellings = (id) => {
    const alts = new Set();
    alts.add(id);
    // _bonus → _bonus_area も試す
    if (!id.endsWith('_area')) alts.add(`${id}_area`);

    const repl = (s, a, b) => s.includes(a) ? s.replace(a, b) : null;
    const v1 = repl(id, 'kanto', 'kantou');        if (v1) { alts.add(v1); alts.add(`${v1}_area`); }
    const v2 = repl(id, 'chubu', 'chuubu');         if (v2) { alts.add(v2); alts.add(`${v2}_area`); }
    const v3 = repl(id, 'chugoku', 'cyuugoku');     if (v3) { alts.add(v3); alts.add(`${v3}_area`); }
    const v4 = repl(id, 'shikoku', 'shikoku');     if (v4) { alts.add(v4); alts.add(`${v4}_area`); }
    const v5 = repl(id, 'kyushu', 'kyushu');       if (v5) { alts.add(v5); alts.add(`${v5}_area`); }

    // 世界系
    const world = ['asia','europe','america','africa'];
    for (const w of world) {
      if (id.startsWith(`${w}_`)) {
        const cap = w[0].toUpperCase() + w.slice(1);
        const wid = id.replace(w, cap);
        alts.add(wid);
        alts.add(`${wid}_area`);
      }
    }
    return Array.from(alts);
  };

  // 地域名抽出（フォールバック用）
  const regionName = stageId.split('_')[0];

  // 試行パスを列挙
  const pathsToTry = [];
  // 1) そのまま
  pathsToTry.push(`/assets/images/backgrounds/${stageId}.webp?v=${timestamp}`);
  // 2) 表記ゆれ・_area などの候補
  for (const a of altSpellings(stageId)) {
    pathsToTry.push(`/assets/images/backgrounds/${a}.webp?v=${timestamp}`);
  }
  // 3) 地域 area1 の汎用フォールバック（webp → png の順）
  pathsToTry.push(`/assets/images/backgrounds/${regionName}_area1.webp?v=${timestamp}`);
  pathsToTry.push(`/assets/images/backgrounds/${regionName}_area1.png?v=${timestamp}`);
  // 4) 学年別のステージ選択画像（最終フォールバック）
  pathsToTry.push(`/assets/images/stage.select/stage.select${getGradeFromStageId(stageId)}.png?v=${timestamp}`);

  for (const path of pathsToTry) {
    try {
      console.log(`背景画像を試行: ${path}`);
      const img = await loadImageWithTransparency(path);
      images[cacheKey] = img;
      console.log(`✅ 背景画像ロード成功: ${path}`);
      return img;
    } catch (error) {
      // 次へ
    }
  }

  // デフォルト
  try {
    const defaultPath = `/assets/images/stage.select/stage.select.png?v=${timestamp}`;
    const fallbackImg = await loadImageWithTransparency(defaultPath);
    images[cacheKey] = fallbackImg;
    return fallbackImg;
  } catch {
    console.error(`すべての背景画像読み込みに失敗: ${stageId}`);
    return null;
  }
}

// 追加：モンスター画像（fullサイズ）を読み込む関数を修正
export async function loadMonsterImage(enemy) {
  if (images[enemy.id]) return images[enemy.id];
  
  // 敵の名前を取得（表示用）
  const enemyName = enemy.name || enemy.id || 'モンスター';
  console.log(`${enemy.id} (${enemyName}) の画像をロード中...`);
  
  // 学年別フォルダマッピング
const gradeFolderMap = {
  1: 'grade1-hokkaido',
  2: 'grade2-touhoku',
  3: 'grade3-kantou',
  4: 'grade4-chuubu',
  5: 'grade5-kinki',
  6: 'grade6-chuugoku',
  // 中学生ステージ用のマッピングを追加
  7: 'grade7-asia',       // 4級
  8: 'grade8-europe',     // 3級
  9: 'grade9-america',    // 準2級
  10:'grade10-africa',    // 2級
  // 追加: 四国・九州
  11:'grade11-shikoku',
  12:'grade12-kyuusyuu',
};
  
  // 学年に基づいてフォルダを決定
  const folder = gradeFolderMap[enemy.grade] || gradeFolderMap[1];
  
  // 画像ファイル名を取得（ID部分のみ）
  const enemyId = enemy.id;
  console.log(`敵ID: ${enemyId}, フォルダ: ${folder}, 学年: ${enemy.grade}`);
  
  // 順番に試す画像パスの配列
  const pathsToTry = [];
  
  // 中学生ステージ（PRV-Exxx形式）の場合
  if (enemyId.startsWith('PRV-')) {
    pathsToTry.push(
      // 1. WebP形式の画像（monsters/full/フォルダ内）
      `/assets/images/monsters/full/${enemyId}.webp`,
      // 2. image-pipeline内のWebP画像
      `/image-pipeline/output/monsters/full/${enemyId}.webp`,
      // 3. PNG形式の代替
      `/image‐pipeline/monsters/monster_${enemyId.replace('PRV-E', '')}.png`
    );
  } else {
    // 小学生ステージ用の既存のパス
    pathsToTry.push(
      // 1. WebP形式の画像（monsters/full/フォルダ内）
      `/assets/images/monsters/full/${folder}/${enemyId}.webp`,
      // 2. 数字のファイル名形式（enemy/フォルダ内）
      `/assets/images/enemy/${enemyId.split('-')[1].replace('E', '')}_${enemyName}.png`,
      // 3. 北海道の敵画像を代替として試す
      `/assets/images/monsters/full/grade1-hokkaido/HKD-${enemyId.split('-')[1]}.webp`,
      // 4. 数字のみのファイル名で北海道フォルダ内を試す
      `/assets/images/enemy/${enemyId.split('-')[1].replace('E', '')}_${enemyName.split('の')[0]}.png`
    );
  }
  
  // 各パスを順番に試す
  for (const path of pathsToTry) {
    try {
      console.log(`画像を試行: ${path}`);
      // 透明度を確保するために loadImageWithTransparency を使用
      const img = await loadImageWithTransparency(path);
      console.log(`✅ 画像ロード成功: ${path}`);
      images[enemyId] = img;
      return img;
    } catch (error) {
      console.log(`画像ロード失敗: ${path}`);
      // 次のパスを試す
    }
  }
  
  // すべてのパスが失敗した場合、代替画像を生成
  console.log(`代替画像を生成: ${enemyId}`);
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 180;
  const ctx = canvas.getContext('2d', { alpha: true });
  
  // 背景は透明
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // シンプルな四角形を描画
  ctx.fillStyle = '#6b8e23';
  ctx.fillRect(40, 30, 160, 120);
  
  // 枠線
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 30, 160, 120);
  
  // テキスト
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(enemyName, canvas.width/2, canvas.height/2);
  
  // キャンバスから画像を生成
  const placeholderImg = new Image();
  
  const placeholderPromise = new Promise((resolve) => {
    placeholderImg.onload = () => {
      resolve(placeholderImg);
    };
  });
  
  // PNG形式で透明度を保持
  placeholderImg.src = canvas.toDataURL('image/png');
  
  // 画像の読み込み完了を待つ
  const finalImg = await placeholderPromise;
  
  // キャッシュに保存
  images[enemyId] = finalImg;
  return finalImg;
}

/* ------------------------------------------------------------------ */
/*  汎用ロードユーティリティ                                           */
/* ------------------------------------------------------------------ */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // CORS対応
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`画像の読み込みに失敗: ${src}`));
    img.src = src;
  });
}

// L.327 付近の loadImageWithTransparency 関数をまるごと置き換えます

function loadImageWithTransparency(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); // パフォーマンスヒントを追加
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // ↓↓↓ ここからが新しい白判定ロジック ↓↓↓
      const threshold = 230; // 白と判定する明るさのしきい値を下げる
      const colorDifferenceThreshold = 20; // R,G,B間の許容色差を上げる

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 明るさの平均値を計算
        const brightness = (r + g + b) / 3;

        // 明るさに応じたアルファ値のグラデーション
        if (brightness > threshold && 
            Math.abs(r - g) < colorDifferenceThreshold &&
            Math.abs(g - b) < colorDifferenceThreshold &&
            Math.abs(b - r) < colorDifferenceThreshold) {
          // 明るさに応じてアルファ値を調整（明るいほど透明に）
          const alphaFactor = Math.min(1, (255 - brightness) / (255 - threshold));
          data[i + 3] = Math.floor(data[i + 3] * alphaFactor);
        }
      }
      // ↑↑↑ ここまでが新しい白判定ロジック ↑↑↑
      
      ctx.putImageData(imageData, 0, 0);
      
      const processedImg = new Image();
      processedImg.onload = () => resolve(processedImg);
      processedImg.src = canvas.toDataURL('image/png');
    };
    
    img.onerror = (e) => reject(new Error(`画像の読み込みに失敗: ${src}`));
    img.src = src;
  });
}

/* ------------------------------------------------------------------ */
/*  JSON ローダ（データレイヤ）                                       */
/* ------------------------------------------------------------------ */

const DATA_BASE = '/data/';

/** すべてのゲームデータ JSON を一括ロード */
export async function loadAllGameData() {
  const files = ['kanji_g1_proto.json', 'enemies_proto.json', 'stages_proto.json'];
  const [kanji, enemy, stage] = await Promise.all(
    files.map(f => fetch(DATA_BASE + f).then(r => r.json()))
  );
  return { kanji, enemy, stage };
}

/**
 * 共通 UI 画像を進捗コールバック付きでまとめてロード
 * @param {(loaded:number, total:number)=>void} onProgress 
 * @returns {Promise<void>}
 */
export async function loadAll(onProgress) {
  const entries = Object.entries(UI_IMAGE_PATHS);
  const total = entries.length;
  let loadedCount = 0;
  onProgress?.(loadedCount, total);

  for (const [key, src] of entries) {
    try {
      const needsTransparency = ['panelStone', 'panelPlayer', 'panelEnemy','iconOnyomi','iconKunyomi'].includes(key);
      const img = await (needsTransparency ? loadImageWithTransparency(src) : loadImage(src));
      images[key] = img;
    } catch {
      console.warn(`⚠️ ${src} の読み込み失敗`);
    }
    loadedCount++;
    onProgress?.(loadedCount, total);
  }
}

// キャッシュクリア関数を追加
export function clearImageCache(stageId = null) {
  if (stageId) {
    // 特定のステージの背景画像キャッシュをクリア
    const cacheKey = `bg_${stageId}`;
    if (images[cacheKey]) {
      delete images[cacheKey];
      console.log(`🗑️ 背景画像キャッシュをクリア: ${stageId}`);
    }
  } else {
    // 全ての背景画像キャッシュをクリア
    Object.keys(images).forEach(key => {
      if (key.startsWith('bg_')) {
        delete images[key];
      }
    });
    console.log('🗑️ 全ての背景画像キャッシュをクリア');
  }
}

/**
 * 石版パネルを描画する関数
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {number} x - X座標
 * @param {number} y - Y座標
 * @param {number} width - 幅
 * @param {number} height - 高さ
 * @param {string} [title=''] - パネルのタイトル（オプション）
 */
export function drawStonePanel(ctx, x, y, width, height, title = '') {
  ctx.save();
  
  // 画像がロードされているか確認
  if (images && images.panelStone) {
    // 9スライス描画（角と辺と中央）
    const sliceSize = 16; // 画像の角部分のサイズ
    
    // 角を描画
    // 左上
    ctx.drawImage(images.panelStone, 0, 0, sliceSize, sliceSize, x, y, sliceSize, sliceSize);
    // 右上
    ctx.drawImage(images.panelStone, images.panelStone.width - sliceSize, 0, sliceSize, sliceSize, x + width - sliceSize, y, sliceSize, sliceSize);
    // 左下
    ctx.drawImage(images.panelStone, 0, images.panelStone.height - sliceSize, sliceSize, sliceSize, x, y + height - sliceSize, sliceSize, sliceSize);
    // 右下
    ctx.drawImage(images.panelStone, images.panelStone.width - sliceSize, images.panelStone.height - sliceSize, sliceSize, sliceSize, x + width - sliceSize, y + height - sliceSize, sliceSize, sliceSize);
    
    // 辺を描画
    // 上辺
    ctx.drawImage(images.panelStone, sliceSize, 0, images.panelStone.width - sliceSize * 2, sliceSize, x + sliceSize, y, width - sliceSize * 2, sliceSize);
    // 下辺
    ctx.drawImage(images.panelStone, sliceSize, images.panelStone.height - sliceSize, images.panelStone.width - sliceSize * 2, sliceSize, x + sliceSize, y + height - sliceSize, width - sliceSize * 2, sliceSize);
    // 左辺
    ctx.drawImage(images.panelStone, 0, sliceSize, sliceSize, images.panelStone.height - sliceSize * 2, x, y + sliceSize, sliceSize, height - sliceSize * 2);
    // 右辺
    ctx.drawImage(images.panelStone, images.panelStone.width - sliceSize, sliceSize, sliceSize, images.panelStone.height - sliceSize * 2, x + width - sliceSize, y + sliceSize, sliceSize, height - sliceSize * 2);
    
    // 中央部分
    ctx.drawImage(images.panelStone, sliceSize, sliceSize, images.panelStone.width - sliceSize * 2, images.panelStone.height - sliceSize * 2, x + sliceSize, y + sliceSize, width - sliceSize * 2, height - sliceSize * 2);
  } else {
    // 画像がロードされていない場合のフォールバック
    ctx.fillStyle = 'rgba(50, 50, 60, 0.8)';
    ctx.fillRect(x, y, width, height);
    
    // 石の質感を表現する細かな線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    
    // 横線
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + height * i / 3);
      ctx.lineTo(x + width, y + height * i / 3);
      ctx.stroke();
    }
    
    // 枠線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  }
  
  // タイトルがある場合は描画
  if (title) {
    ctx.fillStyle = 'white';
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + width / 2, y + 10);
  }
  
  ctx.restore();
}

/**
 * 石版スタイルのボタンを描画する
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {Object} button - ボタン情報 {x, y, w, h, label}
 * @param {boolean} isHovered - ホバー状態かどうか
 * @param {boolean} isPressed - 押下状態かどうか
 */
export function drawStoneButton(ctx, button, isHovered, isPressed) {
  const { x, y, w, h, label } = button;
  
  // 状態に応じた画像を選択
  let buttonImg;
  if (isPressed) {
    buttonImg = images.buttonStonePressed;
  } else if (isHovered) {
    buttonImg = images.buttonStoneHover;
  } else {
    buttonImg = images.buttonStoneNormal;
  }
  
  // ボタン画像を描画
  if (buttonImg) {
    ctx.drawImage(buttonImg, x, y, w, h);
  } else {
    // 画像がない場合のフォールバック
    ctx.fillStyle = isPressed ? '#7f8c8d' : (isHovered ? '#95a5a6' : '#bdc3c7');
    ctx.fillRect(x, y, w, h);
  }
  
  // ボタンテキストを描画
  ctx.fillStyle = 'white';
  ctx.font = '18px "UDデジタル教科書体", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

// ステージIDから学年を取得するヘルパー関数
function getGradeFromStageId(stageId) {
  // 世界
  if (stageId.startsWith('Asia_') || stageId.startsWith('asia_')) return 12; // 4級
  if (stageId.startsWith('Europe_') || stageId.startsWith('europe_')) return 13; // 3級
  if (stageId.startsWith('America_') || stageId.startsWith('america_')) return 14; // 準2級
  if (stageId.startsWith('Africa_') || stageId.startsWith('africa_')) return 15; // 2級
  
  // 日本（_area / _bonus ともに対応）
  const gradeMapping = {
    hokkaido_: 1,
    tohoku_: 2,
    kanto_: 3, kantou_: 3,
    chubu_: 4, chuubu_: 4,
    kinki_: 5,
    chugoku_: 6, chuugoku_: 6, cyuugoku_: 6,
    shikoku_: 11,     // 追加
    kyushu_: 12,      // 追加
  };
  for (const prefix in gradeMapping) {
    if (stageId.startsWith(prefix)) return gradeMapping[prefix];
  }
  return '';
}


