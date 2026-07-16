// src/utils/coordinateUtils.js - 完全な座標変換ソリューション

/**
 * 全画面対応の堅牢な座標変換ユーティリティ
 * レターボックス、ピラーボックス、高DPI対応
 */

/**
 * Canvas要素のクリック座標を正確なゲーム座標に変換
 * @param {Event} event - マウス/タッチイベント
 * @param {HTMLCanvasElement} canvas - Canvas要素
 * @returns {{x: number, y: number}} ゲーム内座標
 */
export function getGameCoordinates(event, canvas) {
    // イベント座標を取得（タッチ対応）
    let clientX, clientY;
    if (event.changedTouches && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
  
    // Canvas要素の表示情報を取得
    const rect = canvas.getBoundingClientRect();
    const canvasDisplayWidth = rect.width;
    const canvasDisplayHeight = rect.height;
    const canvasInternalWidth = canvas.width;
    const canvasInternalHeight = canvas.height;
  
    // アスペクト比の計算
    const internalAspect = canvasInternalWidth / canvasInternalHeight;
    const displayAspect = canvasDisplayWidth / canvasDisplayHeight;
  
    // 表示領域内での相対座標（0～1）
    let relativeX = (clientX - rect.left) / canvasDisplayWidth;
    let relativeY = (clientY - rect.top) / canvasDisplayHeight;
  
    // object-fit: contain による黒帯（レターボックス/ピラーボックス）の補正
    if (Math.abs(internalAspect - displayAspect) > 0.001) {
      if (displayAspect > internalAspect) {
        // 横長表示（左右に黒帯） - ピラーボックス
        const actualContentWidth = canvasDisplayHeight * internalAspect;
        const horizontalPadding = (canvasDisplayWidth - actualContentWidth) / 2;
        
        // 黒帯領域のクリックは無視
        if (clientX < rect.left + horizontalPadding || 
            clientX > rect.left + horizontalPadding + actualContentWidth) {
          return { x: -1, y: -1 }; // 無効座標を返す
        }
        
        relativeX = (clientX - rect.left - horizontalPadding) / actualContentWidth;
      } else {
        // 縦長表示（上下に黒帯） - レターボックス
        const actualContentHeight = canvasDisplayWidth / internalAspect;
        const verticalPadding = (canvasDisplayHeight - actualContentHeight) / 2;
        
        // 黒帯領域のクリックは無視
        if (clientY < rect.top + verticalPadding || 
            clientY > rect.top + verticalPadding + actualContentHeight) {
          return { x: -1, y: -1 }; // 無効座標を返す
        }
        
        relativeY = (clientY - rect.top - verticalPadding) / actualContentHeight;
      }
    }
  
    // 範囲制限（安全措置）
    relativeX = Math.max(0, Math.min(1, relativeX));
    relativeY = Math.max(0, Math.min(1, relativeY));
  
    // ゲーム内座標に変換
    const gameX = relativeX * canvasInternalWidth;
    const gameY = relativeY * canvasInternalHeight;
  
    return { x: Math.round(gameX), y: Math.round(gameY) };
  }
  
  /**
   * デバッグ情報を出力（開発時のみ使用）
   * @param {Event} event 
   * @param {HTMLCanvasElement} canvas 
   */
  export function debugCoordinates(event, canvas) {
    const coords = getGameCoordinates(event, canvas);
    const rect = canvas.getBoundingClientRect();
    
    console.group('🎯 座標デバッグ情報');
    console.log('📍 クリック位置(クライアント座標):', event.clientX, event.clientY);
    console.log('📐 Canvas表示サイズ:', `${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`);
    console.log('🖥️  Canvas内部解像度:', `${canvas.width}×${canvas.height}`);
    console.log('🎮 変換後ゲーム座標:', `(${coords.x}, ${coords.y})`);
    console.log('📊 アスペクト比 - 内部:', (canvas.width/canvas.height).toFixed(3), '表示:', (rect.width/rect.height).toFixed(3));
    console.groupEnd();
    
    return coords;
  }
  
  /**
   * 座標変換が有効かどうかを判定
   * @param {{x: number, y: number}} coords - getGameCoordinatesの戻り値
   * @returns {boolean} 有効な座標ならtrue
   */
  export function isValidCoordinates(coords) {
    return coords.x >= 0 && coords.y >= 0;
  }

  /**
   * ゲーム内座標を画面（クライアント）座標に変換する
   * getGameCoordinates の逆変換。DOM要素をCanvas上の描画位置に重ねる際に使う。
   * @param {number} gameX
   * @param {number} gameY
   * @param {HTMLCanvasElement} canvas
   * @returns {{x: number, y: number, scale: number}} 画面座標と表示スケール
   */
  export function gameToScreenCoordinates(gameX, gameY, canvas) {
    const rect = canvas.getBoundingClientRect();
    const internalAspect = canvas.width / canvas.height;
    const displayAspect = rect.width / rect.height;

    let contentLeft = rect.left;
    let contentTop = rect.top;
    let contentWidth = rect.width;
    let contentHeight = rect.height;

    // object-fit: contain による黒帯を除いた実コンテンツ領域を求める
    if (Math.abs(internalAspect - displayAspect) > 0.001) {
      if (displayAspect > internalAspect) {
        contentWidth = rect.height * internalAspect;
        contentLeft = rect.left + (rect.width - contentWidth) / 2;
      } else {
        contentHeight = rect.width / internalAspect;
        contentTop = rect.top + (rect.height - contentHeight) / 2;
      }
    }

    return {
      x: contentLeft + (gameX / canvas.width) * contentWidth,
      y: contentTop + (gameY / canvas.height) * contentHeight,
      scale: contentWidth / canvas.width
    };
  }
  
  /**
   * Canvas要素を全画面表示に最適化（安全なCSS設定）
   * @param {HTMLCanvasElement} canvas 
   */
  export function optimizeCanvasForFullscreen(canvas) {
    const style = canvas.style;
    
    // 既存のスタイルをクリア
    style.removeProperty('image-rendering');
    
    // 全画面最適化
    style.position = 'fixed';
    style.top = '0';
    style.left = '0';
    style.width = '100vw';
    style.height = '100vh';
    style.zIndex = '1000';
    style.backgroundColor = '#000';
    
    // アスペクト比維持（重要）
    style.objectFit = 'contain';
    style.objectPosition = 'center';
    
    // 高品質レンダリング
    style.imageRendering = 'auto';
    
    console.log('✅ Canvas全画面最適化完了');
  }
  
  /**
   * レスポンシブ対応のCanvas初期化
   * @param {HTMLCanvasElement} canvas 
   * @param {number} baseWidth - 基準幅（800）
   * @param {number} baseHeight - 基準高さ（600）
   */
  export function initResponsiveCanvas(canvas, baseWidth = 800, baseHeight = 600) {
    // 内部解像度を設定
    canvas.width = baseWidth;
    canvas.height = baseHeight;
    
    const ctx = canvas.getContext('2d');
    
    // 高DPI対応（必要に応じて）
    const devicePixelRatio = window.devicePixelRatio || 1;
    if (devicePixelRatio > 1 && devicePixelRatio <= 2) { // 過度な高解像度は避ける
      const scaledWidth = baseWidth * devicePixelRatio;
      const scaledHeight = baseHeight * devicePixelRatio;
      
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      
      // CSS表示サイズは維持
      canvas.style.width = baseWidth + 'px';
      canvas.style.height = baseHeight + 'px';
      
      // コンテキストをスケール
      ctx.scale(devicePixelRatio, devicePixelRatio);
      
      console.log(`📱 高DPI対応: ${devicePixelRatio}x スケーリング適用`);
    }
    
    return ctx;
  }
  
  /**
   * 画面リサイズ時のCanvas調整
   */
  export function handleCanvasResize(canvas) {
    // CSSサイズの再計算をトリガー
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    
    // 少し遅延してスタイル確定を待つ
    setTimeout(() => {
      console.log('🔄 Canvas表示サイズ更新完了');
    }, 100);
  }
  
  // リサイズイベントの登録（自動で適用）
  if (typeof window !== 'undefined') {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
          handleCanvasResize(canvas);
        }
      }, 150); // デバウンス
    });
    
    // 向き変更対応（モバイル）
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
          handleCanvasResize(canvas);
        }
      }, 500); // 向き変更完了まで待機
    });
  }