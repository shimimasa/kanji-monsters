// js/screens/monsterDexScreen.js
import { loadDex, loadSeenMonsters, markAsSeen, isNewMonster, loadFavorites, saveFavorites } from '../../models/monsterDex.js';
import { getMonsterById, getAllMonsterIds } from '../../loaders/dataLoader.js';
import { publish } from '../../core/eventBus.js';
import { gameState } from '../../core/gameState.js';

// --- グローバルスコープにあったヘルパー関数を、このファイル内に移動 ---

// 学年別フォルダマッピング（世界 7-10 を追加）
const gradeFolderMap = {
  1: 'grade1-hokkaido',
  2: 'grade2-touhoku',
  3: 'grade3-kantou',
  4: 'grade4-chuubu',
  5: 'grade5-kinki',
  6: 'grade6-chuugoku',
  7: 'grade7-asia',
  8: 'grade8-europe',
  9: 'grade9-america',
  10: 'grade10-africa',
  11: 'grade11-shikoku',
  12: 'grade12-kyuusyuu',
};

// 地方/地域マッピング
const japanRegionMap = {
  1: '北海道',
  2: '東北',
  3: '関東',
  4: '中部',
  5: '近畿',
  6: '中国',
  11: '四国',
  12: '九州',
};

const worldRegionMap = {
  7: 'アジア',
  8: 'ヨーロッパ',
  9: 'アメリカ大陸',
  10: 'アフリカ大陸'
};

// かな正規化（カタカナ→ひらがな、NFKC、空白除去）
function normalizeKana(str) {
  const s = (str || '').normalize('NFKC').toLowerCase();
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0x30A1 && code <= 0x30F6) {
      out += String.fromCharCode(code - 0x60); // カタカナ→ひらがな
    } else if (ch === 'ヴ') {
      out += 'ゔ';
    } else {
      out += ch;
    }
  }
  return out.replace(/[ぁぃぅぇぉっゃゅょゎ]/g, m => ({
    'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','っ':'つ','ゃ':'や','ゅ':'ゆ','ょ':'よ','ゎ':'わ'
  }[m] || m)).replace(/\s+/g, '').trim();
}

function createCard(monster, { showUncollected = false, isFavorite = false, onToggleFavorite = null } = {}) {
  const card = document.createElement('div');
  card.classList.add('monster-card');

  const isCollected = !!monster.collected;
  if (!isCollected && !showUncollected) {
    return null;
  }

  card.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCollected) {
      showMonsterModal(monster);
      markAsSeen(monster.id);
      const newBadge = card.querySelector('.new-badge');
      if (newBadge) newBadge.remove();
    }
  });

  const img = document.createElement('img');
  const folder = gradeFolderMap[monster.grade] || gradeFolderMap[1];
  const thumbPath = `/assets/images/monsters/thumb/${folder}/${monster.id}.webp`;
  img.dataset.thumb = thumbPath;
  img.alt = monster.name;
  if (!isCollected) {
    img.style.filter = 'grayscale(100%) brightness(0.55) contrast(0.9)';
  }
  card.appendChild(img);

  // お気に入り（☆）トグル
  const favBtn = document.createElement('button');
  favBtn.classList.add('fav-toggle');
  favBtn.textContent = isFavorite ? '★' : '☆';
  Object.assign(favBtn.style, {
    position: 'absolute',
    right: '8px',
    top: '8px',
    fontSize: '20px',
    lineHeight: '20px',
    background: 'transparent',
    border: 'none',
    color: isFavorite ? '#ffd54a' : '#ffffff',
    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
    cursor: 'pointer',
    padding: '0'
  });
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(monster.id, !isFavorite);
    }
  });
  card.appendChild(favBtn);

  const nameEl = document.createElement('p');
  nameEl.textContent = isCollected ? monster.name : '？？？';
  nameEl.classList.add('monster-name');
  card.appendChild(nameEl);

  const prefectureEl = document.createElement('p');
  const regionFallback = ([1,2,3,4,5,6,11,12].includes(monster.grade)
    ? japanRegionMap[monster.grade] : worldRegionMap[monster.grade]);
  prefectureEl.textContent = isCollected ? (monster.prefecture || regionFallback || '不明') : '？？？';
  prefectureEl.classList.add('monster-prefecture');
  card.appendChild(prefectureEl);

  if (isNewMonster(monster.id) && isCollected) {
    const newBadge = document.createElement('div');
    newBadge.classList.add('new-badge');
    newBadge.textContent = 'NEW!';
    card.appendChild(newBadge);
  }

  observer.observe(card);
  return card;
}

// IntersectionObserver を用いたサムネイル遅延読み込み
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target.querySelector('img');
      img.src = img.dataset.thumb;
      observer.unobserve(entry.target);
    }
  });
}, { rootMargin: '200px' });



// モンスター詳細モーダルを表示する関数
function showMonsterModal(monster) {
  const modal = document.createElement('div');
  modal.classList.add('monster-modal');
  Object.assign(modal.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '100001',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });

  const modalContent = document.createElement('div');
  modalContent.classList.add('modal-content');

  // 閉じるボタン
  const closeBtn = document.createElement('button');
  closeBtn.classList.add('modal-close');
  closeBtn.textContent = '×';

  // Escで閉じる
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      window.removeEventListener('keydown', onEsc);
      publish('playSE', 'cancel');
    }
  };
  window.addEventListener('keydown', onEsc);

  closeBtn.onclick = () => {
    modal.remove();
    window.removeEventListener('keydown', onEsc);
    publish('playSE', 'cancel');
  };

  // モンスター画像（フル画像を表示）
  const img = document.createElement('img');
  const folder = gradeFolderMap[monster.grade] || gradeFolderMap[1];
  img.src = `/assets/images/monsters/full/${folder}/${monster.id}.webp`;
  img.alt = monster.name;
  img.classList.add('modal-monster-image');

  // 情報
  const info = document.createElement('div');
  info.classList.add('monster-info');
  info.innerHTML = `
        <h2>${monster.name}</h2>
    <p><strong>地域:</strong> ${monster.prefecture || ([1,2,3,4,5,6,11,12].includes(monster.grade)
      ? japanRegionMap[monster.grade] : worldRegionMap[monster.grade]) || '不明'}</p>
    <p><strong>カテゴリ:</strong> ${monster.category || '不明'}</p>
    <p><strong>生息地:</strong> ${monster.habitat || '不明'}</p>
    <p><strong>説明:</strong> ${monster.desc || '—'}</p>
    <p><strong>豆知識:</strong> ${monster.trivia || '—'}</p>
  `;

  modalContent.appendChild(closeBtn);
  modalContent.appendChild(img);
  modalContent.appendChild(info);
  modal.appendChild(modalContent);

  // オーバーレイクリックで閉じる
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
      window.removeEventListener('keydown', onEsc);
      publish('playSE', 'cancel');
    }
  };

  document.body.appendChild(modal);
  publish('playSE', 'decide');
}

const monsterDexState = {
  canvas: null,
  dexSet: null,
  seenSet: null,
  allMonsterIds: [],
  filteredMonsterIds: [],
  
  // ページ管理
  itemsPerPage: 15,
  currentPage: 0,
  totalPages: 0,

  // フィルタ・ソート
  currentRegionFilter: 'all',
  currentSortOrder: 'id',
  currentMode: 'japan',

  // 追加状態
  favoritesSet: new Set(),
  favoritesOnly: false,
  favoritesFirst: false,
  searchQuery: '',
  showUncollectedSilhouette: false,

  // 保存キー
  _prefsKey: 'krb_monsterDex_prefs_v1',

  // DOM
  container: null,

  enter(canvas) {
    this.canvas = canvas || document.getElementById('gameCanvas');
    
    if (this.canvas) {
      this._prevCanvasVisibility = this.canvas.style.visibility;
      this._prevCanvasPointer = this.canvas.style.pointerEvents;
      this.canvas.style.visibility = 'hidden';
      this.canvas.style.pointerEvents = 'none';
    }
  
    publish('playBGM', 'bgm_monsterDex');
  
    this.dexSet = loadDex();
    this.seenSet = loadSeenMonsters();
    this.favoritesSet = loadFavorites();
  
    this.allMonsterIds = getAllMonsterIds().filter(id => {
      const idStr = String(id);
      if (idStr.startsWith('PRV-')) return false;
      const m = getMonsterById(id);
      return !!m;
    });
  
    // 既存デフォルト
    this.currentMode = 'japan';
    this.currentRegionFilter = 'all';
  
    // 設定復元
    this.loadPreferences();
  
    this.applyFiltersAndSort();
    // ページ境界補正
    this.currentPage = Math.min(Math.max(0, this.currentPage || 0), Math.max(0, this.totalPages - 1));
  
    this.createDOMContainer();
    this.renderPage();
  
    this._keyHandler = e => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        this.changePage(this.currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        this.changePage(this.currentPage + 1);
      }
    };
    window.addEventListener('keydown', this._keyHandler);
    import('../../tutorial/TutorialManager.js').then(m => m.default.startIfNeeded('monsterDex', { canvas: this.canvas }));
  },

  /** DOMコンテナを作成（KanjiDexと統一） */
  createDOMContainer() {
    // 既存のコンテナがあれば削除
    if (this.container) {
      this.container.remove();
    }

    // メインコンテナを作成
    this.container = document.createElement('div');
    this.container.id = 'monsterDexContainer';
    this.container.className = 'monster-dex-container';
    Object.assign(this.container.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '100000',
      background: '#2c1810', // 図鑑の背景色（KanjiDexと同じ）
      overflowY: 'auto',
      border: 'none',
      outline: 'none'
    });

    document.body.appendChild(this.container);
  },

  /** 現在モードに応じた学年リストを返す */
  _getAllowedGrades() {
    return this.currentMode === 'japan' ? [1,2,3,4,5,6,11,12] : [7,8,9,10];
  },

  /** 地域ごとのコンプリート状況を計算（現在モードのみ） */
  calculateRegionCompletion() {
    const regionCompletion = {};
    const allowed = this._getAllowedGrades();

    for (const grade of allowed) {
      const regionMonsters = this.allMonsterIds.filter(id => {
        const monster = getMonsterById(id);
        return monster && monster.grade === grade;
      });
      const collectedInRegion = regionMonsters.filter(id => this.dexSet.has(id));
      regionCompletion[grade] = {
        total: regionMonsters.length,
        collected: collectedInRegion.length,
        isComplete: regionMonsters.length > 0 && collectedInRegion.length === regionMonsters.length
      };
    }
    return regionCompletion;
  },

/** 設定の保存 */
savePreferences() {
  try {
    const prefs = {
      currentMode: this.currentMode,
      currentRegionFilter: this.currentRegionFilter,
      currentSortOrder: this.currentSortOrder,
      favoritesOnly: this.favoritesOnly,
      favoritesFirst: this.favoritesFirst,
      currentPage: this.currentPage,
      searchQuery: this.searchQuery,
      showUncollectedSilhouette: this.showUncollectedSilhouette
    };
    localStorage.setItem(this._prefsKey, JSON.stringify(prefs));
  } catch (e) {
    // noop
  }
},

/** 設定の読込 */
loadPreferences() {
  try {
    const raw = localStorage.getItem(this._prefsKey);
    if (!raw) return;
    const p = JSON.parse(raw) || {};
    if (p.currentMode === 'japan' || p.currentMode === 'world') this.currentMode = p.currentMode;
    this.currentRegionFilter = (p.currentRegionFilter === 'all' || typeof p.currentRegionFilter === 'number') ? p.currentRegionFilter : 'all';
    this.currentSortOrder = (p.currentSortOrder === 'name') ? 'name' : 'id';
    this.favoritesOnly = !!p.favoritesOnly;
    this.favoritesFirst = !!p.favoritesFirst;
    this.currentPage = Number.isInteger(p.currentPage) ? p.currentPage : 0;
    this.searchQuery = typeof p.searchQuery === 'string' ? p.searchQuery : '';
    this.showUncollectedSilhouette = !!p.showUncollectedSilhouette;
  } catch (e) {
    // noop
  }
},

  /** フィルタリングとソートを適用 */
  applyFiltersAndSort() {
    const allowed = this._getAllowedGrades();
  
    let filtered = this.allMonsterIds.filter(id => {
      const m = getMonsterById(id);
      return m && allowed.includes(m.grade);
    });
  
    if (this.currentRegionFilter !== 'all') {
      filtered = filtered.filter(id => {
        const monster = getMonsterById(id);
        return monster && monster.grade === this.currentRegionFilter;
      });
    }
  
    // 検索（名前ひらがな正規化）
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = normalizeKana(this.searchQuery);
      filtered = filtered.filter(id => {
        const m = getMonsterById(id);
        if (!m) return false;
        const name = normalizeKana(m.name);
        return name.includes(q);
      });
    }
  
    // お気に入りのみ
    if (this.favoritesOnly) {
      filtered = filtered.filter(id => this.favoritesSet.has(id));
    }
  
    // 未捕獲の扱い
    if (!this.showUncollectedSilhouette) {
      filtered = filtered.filter(id => this.dexSet.has(id));
    }
  
    // ソート
    filtered.sort((a, b) => {
      const aM = getMonsterById(a);
      const bM = getMonsterById(b);
      const aFav = this.favoritesSet.has(a);
      const bFav = this.favoritesSet.has(b);
  
      if (this.favoritesFirst && aFav !== bFav) {
        return aFav ? -1 : 1;
      }
  
      if (this.currentSortOrder === 'name') {
        const an = aM?.name || '';
        const bn = bM?.name || '';
        return an.localeCompare(bn, 'ja');
      } else {
        return String(a).localeCompare(String(b));
      }
    });
  
    this.filteredMonsterIds = filtered;
    this.totalPages = Math.ceil(this.filteredMonsterIds.length / this.itemsPerPage) || 1;
  },

  /** 現在のページを描画する（KanjiDexスタイルに統一） */
  renderPage() {
    if (!this.container) return;

    // 既存の要素を全てクリア
    this.container.innerHTML = '';

    // 地域コンプリート状況を計算
    const regionCompletion = this.calculateRegionCompletion();
    const allowed = this._getAllowedGrades();

    // === 統計エリア（KanjiDexと同じネイビーブルー系） ===
    const statsDiv = document.createElement('div');
    statsDiv.className = 'monster-collection-stats';
    Object.assign(statsDiv.style, {
      background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.7), rgba(59, 130, 246, 0.4))',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      margin: '16px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 2px 8px rgba(30, 58, 138, 0.2)'
    });
    
    // 現在モードの総数と収集数
    const idsInMode = this.allMonsterIds.filter(id => {
      const m = getMonsterById(id);
      return m && allowed.includes(m.grade);
    });
    const totalMonsters = idsInMode.length;
    const totalCollected = idsInMode.filter(id => this.dexSet.has(id)).length;
    const collectionRate = totalMonsters > 0 ? Math.round((totalCollected / totalMonsters) * 100) : 0;
    
    const statsText = document.createElement('div');
    statsText.className = 'monster-stats-text';
    Object.assign(statsText.style, {
      color: '#ffffff',
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '8px'
    });
    statsText.textContent = `モンスター収集率: ${totalCollected}/${totalMonsters} (${collectionRate}%)`;
    
    const progressBar = document.createElement('div');
    progressBar.className = 'monster-progress-bar';
    Object.assign(progressBar.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      height: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    });
    
    const progressFill = document.createElement('div');
    progressFill.className = 'monster-progress-fill';
    Object.assign(progressFill.style, {
      background: 'linear-gradient(90deg, #28a745, #20c997)',
      height: '100%',
      width: `${collectionRate}%`,
      transition: 'width 0.6s ease',
      borderRadius: '10px'
    });
    
    progressBar.appendChild(progressFill);
    statsDiv.appendChild(statsText);
    statsDiv.appendChild(progressBar);

    // === ナビゲーションエリア（KanjiDexと同じスタイル） ===
    const navDiv = document.createElement('div');
    navDiv.className = 'monster-dex-navigation';
    Object.assign(navDiv.style, {
      background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.85), rgba(59, 130, 246, 0.6))',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      borderRadius: '12px',
      padding: '16px',
      margin: '16px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px'
    });


    // === 中央コントロール（ソート＋検索） ===
const centerControls = document.createElement('div');
centerControls.className = 'nav-controls-center';
Object.assign(centerControls.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  justifyContent: 'center',
  flex: '1',
  flexWrap: 'wrap'
});

// ソートボタン
const createSortButton = (text, mode, isActive) => {
  const btn = document.createElement('button');
  btn.className = `btn-sort ${isActive ? 'sort-active' : ''}`;
  btn.textContent = text;
  const baseStyle = {
    background: isActive ? 
      'linear-gradient(135deg, #f39c12, #e67e22)' : 
      'linear-gradient(135deg, #ffc107, #e0a800)',
    color: isActive ? 'white' : '#000',
    border: isActive ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    boxShadow: isActive ? 
      '0 0 12px rgba(243, 156, 18, 0.5)' : 
      '0 2px 4px rgba(0, 0, 0, 0.2)'
  };
  Object.assign(btn.style, baseStyle);
  if (!isActive) {
    btn.addEventListener('mouseenter', () => {
      Object.assign(btn.style, {
        background: 'linear-gradient(135deg, #e0a800, #d39e00)',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
      });
    });
    btn.addEventListener('mouseleave', () => Object.assign(btn.style, baseStyle));
  }
  btn.addEventListener('click', () => {
    this.currentSortOrder = mode;
    this.applyFiltersAndSort();
    this.currentPage = 0;
    this.renderPage();
    this.savePreferences();
    publish('playSE', 'decide');
  });
  return btn;
};

const sortByIdBtn = createSortButton('📊 図鑑番号順', 'id', this.currentSortOrder === 'id');
const sortByNameBtn = createSortButton('🔤 五十音順', 'name', this.currentSortOrder === 'name');
centerControls.appendChild(sortByIdBtn);
centerControls.appendChild(sortByNameBtn);

// 検索ボックス
const searchInput = document.createElement('input');
Object.assign(searchInput.style, {
  background: 'rgba(255,255,255,0.15)',
  color: 'white',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '14px',
  minWidth: '200px'
});
searchInput.type = 'text';
searchInput.placeholder = '名前で検索…';
searchInput.value = this.searchQuery || '';
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    this.searchQuery = searchInput.value;
    this.applyFiltersAndSort();
    this.currentPage = 0;
    this.renderPage();
    this.savePreferences();
  }, 300);
});
centerControls.appendChild(searchInput);

// === 右側コントロール（ページネーション＋トグル） ===
const rightControls = document.createElement('div');
rightControls.className = 'nav-controls-right';
Object.assign(rightControls.style, {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap'
});

// トグル群
const toggles = document.createElement('div');
Object.assign(toggles.style, { display: 'flex', alignItems: 'center', gap: '8px' });

// お気に入りのみ
const favOnlyLabel = document.createElement('label');
favOnlyLabel.style.color = '#fff';
const favOnlyCb = document.createElement('input');
favOnlyCb.type = 'checkbox';
favOnlyCb.checked = !!this.favoritesOnly;
favOnlyCb.addEventListener('change', () => {
  this.favoritesOnly = favOnlyCb.checked;
  this.applyFiltersAndSort();
  this.currentPage = 0;
  this.renderPage();
  this.savePreferences();
  publish('playSE', 'decide');
});
favOnlyLabel.appendChild(favOnlyCb);
favOnlyLabel.appendChild(document.createTextNode(' ☆のみ'));
toggles.appendChild(favOnlyLabel);

// お気に入り優先
const favFirstLabel = document.createElement('label');
favFirstLabel.style.color = '#fff';
const favFirstCb = document.createElement('input');
favFirstCb.type = 'checkbox';
favFirstCb.checked = !!this.favoritesFirst;
favFirstCb.addEventListener('change', () => {
  this.favoritesFirst = favFirstCb.checked;
  this.applyFiltersAndSort();
  this.currentPage = 0;
  this.renderPage();
  this.savePreferences();
  publish('playSE', 'decide');
});
favFirstLabel.appendChild(favFirstCb);
favFirstLabel.appendChild(document.createTextNode(' ☆優先'));
toggles.appendChild(favFirstLabel);

// 未捕獲シルエット
const silLabel = document.createElement('label');
silLabel.style.color = '#fff';
const silCb = document.createElement('input');
silCb.type = 'checkbox';
silCb.checked = !!this.showUncollectedSilhouette;
silCb.addEventListener('change', () => {
  this.showUncollectedSilhouette = silCb.checked;
  this.applyFiltersAndSort();
  this.currentPage = 0;
  this.renderPage();
  this.savePreferences();
  publish('playSE', 'decide');
});
silLabel.appendChild(silCb);
silLabel.appendChild(document.createTextNode(' 未捕獲を表示'));
toggles.appendChild(silLabel);

// ページネーション（既存）
const createPageButton = (text, action, disabled = false) => {
  const btn = document.createElement('button');
  btn.className = 'btn-pagination';
  btn.textContent = text;
  btn.disabled = disabled;
  const baseStyle = {
    background: disabled ? 
      'linear-gradient(135deg, #6c757d, #5a6268)' : 
      'linear-gradient(135deg, #4a90e2, #357abd)',
    color: disabled ? '#adb5bd' : 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    padding: '8px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s ease',
    boxShadow: disabled ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.2)'
  };
  Object.assign(btn.style, baseStyle);
  if (!disabled) {
    btn.addEventListener('mouseenter', () => {
      Object.assign(btn.style, {
        background: 'linear-gradient(135deg, #357abd, #2e6da4)',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
      });
    });
    btn.addEventListener('mouseleave', () => Object.assign(btn.style, baseStyle));
  }
  btn.addEventListener('click', action);
  return btn;
};

const prevBtn = createPageButton('⬅️ 前のページ', () => this.changePage(this.currentPage - 1), this.currentPage === 0);
const pageInfo = document.createElement('span');
pageInfo.className = 'page-info';
Object.assign(pageInfo.style, {
  background: 'rgba(255, 255, 255, 0.15)',
  color: 'white',
  padding: '6px 12px',
  borderRadius: '6px',
  fontWeight: '600',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  minWidth: '80px',
  textAlign: 'center'
});
pageInfo.textContent = `${this.currentPage + 1} / ${this.totalPages}`;
const nextBtn = createPageButton('次のページ ➡️', () => this.changePage(this.currentPage + 1), this.currentPage >= this.totalPages - 1);

rightControls.appendChild(toggles);
rightControls.appendChild(prevBtn);
rightControls.appendChild(pageInfo);
rightControls.appendChild(nextBtn);

    // === 左側コントロール ===
    const leftControls = document.createElement('div');
    leftControls.className = 'nav-controls-left';
    Object.assign(leftControls.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });

    // 戻るボタン
    const backButton = document.createElement('button');
    backButton.className = 'btn-back';
    backButton.textContent = '🐾 ステージ選択へ';
    Object.assign(backButton.style, {
      background: 'linear-gradient(135deg, #6c757d, #5a6268)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
    });
    
    backButton.addEventListener('mouseenter', () => {
      Object.assign(backButton.style, {
        background: 'linear-gradient(135deg, #5a6268, #495057)',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
      });
    });
    
    backButton.addEventListener('mouseleave', () => {
      Object.assign(backButton.style, {
        background: 'linear-gradient(135deg, #6c757d, #5a6268)',
        transform: 'translateY(0)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
      });
    });

    backButton.addEventListener('click', () => {
      publish('playSE', 'decide');
      publish('playBGM', 'title');
      const targetScreen = (gameState.previousScreen === 'worldStageSelect')
        ? 'worldStageSelect'
        : 'stageSelect';
      publish('changeScreen', targetScreen);
    });
    leftControls.appendChild(backButton);

    // 種別セレクト（日本/世界）
    const modeLabel = document.createElement('span');
    modeLabel.textContent = '種別：';
    Object.assign(modeLabel.style, { color: '#ffffff', fontWeight: '500', marginRight: '8px' });

    const modeSelect = document.createElement('select');
    Object.assign(modeSelect.style, {
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    });
    modeSelect.innerHTML = `
      <option value="japan">日本ゴトモン</option>
      <option value="world">世界ゴトモン</option>
    `;
    modeSelect.value = this.currentMode;
    modeSelect.addEventListener('change', (e) => {
      this.currentMode = e.target.value;
      this.currentRegionFilter = 'all';
      this.applyFiltersAndSort();
      this.currentPage = 0;
      this.renderPage();
      publish('playSE', 'decide');
    });
    leftControls.appendChild(modeLabel);
    leftControls.appendChild(modeSelect);

    // 地域セレクト
    const regionLabel = document.createElement('span');
    regionLabel.className = 'monster-region-label';
    regionLabel.textContent = '地域：';
    Object.assign(regionLabel.style, {
      color: '#ffffff',
      fontWeight: '500',
      marginRight: '8px'
    });

    const regionSelect = document.createElement('select');
    regionSelect.className = 'monster-region-filter';
    Object.assign(regionSelect.style, {
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    });

    let optionsHTML = '<option value="all">すべて</option>';
    const regionNames = this.currentMode === 'japan' ? japanRegionMap : worldRegionMap;
    const grades = this._getAllowedGrades();
    for (const grade of grades) {
      const regionName = regionNames[grade];
      const completion = regionCompletion[grade] || { isComplete: false };
      const crownIcon = completion.isComplete ? ' 👑' : '';
      optionsHTML += `<option value="${grade}" style="background: rgba(30, 58, 138, 0.9); color: white;">${regionName}${crownIcon}</option>`;
    }
    regionSelect.innerHTML = optionsHTML;
    regionSelect.value = this.currentRegionFilter;
    
    regionSelect.addEventListener('change', (e) => {
      this.currentRegionFilter = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
      this.applyFiltersAndSort();
      this.currentPage = 0;
      this.renderPage();
      publish('playSE', 'decide');
    });

    leftControls.appendChild(regionLabel);
    leftControls.appendChild(regionSelect);

    // === 中央コントロール（ソートボタン） ===
    const centerControls = document.createElement('div');
    centerControls.className = 'nav-controls-center';
    Object.assign(centerControls.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      justifyContent: 'center',
      flex: '1'
    });

    // ソートボタンを作成する関数
    const createSortButton = (text, mode, isActive) => {
      const btn = document.createElement('button');
      btn.className = `btn-sort ${isActive ? 'sort-active' : ''}`;
      btn.textContent = text;
      
      const baseStyle = {
        background: isActive ? 
          'linear-gradient(135deg, #f39c12, #e67e22)' : 
          'linear-gradient(135deg, #ffc107, #e0a800)',
        color: isActive ? 'white' : '#000',
        border: isActive ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.3s ease',
        boxShadow: isActive ? 
          '0 0 12px rgba(243, 156, 18, 0.5)' : 
          '0 2px 4px rgba(0, 0, 0, 0.2)'
      };
      
      Object.assign(btn.style, baseStyle);
      
      if (!isActive) {
        btn.addEventListener('mouseenter', () => {
          Object.assign(btn.style, {
            background: 'linear-gradient(135deg, #e0a800, #d39e00)',
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
          });
        });
        
        btn.addEventListener('mouseleave', () => {
          Object.assign(btn.style, baseStyle);
        });
      }
      
      btn.addEventListener('click', () => {
        this.currentSortOrder = mode;
        this.applyFiltersAndSort();
        this.currentPage = 0;
        this.renderPage();
        publish('playSE', 'decide');
      });
      
      return btn;
    };

    const sortByIdBtn = createSortButton('📊 図鑑番号順', 'id', this.currentSortOrder === 'id');
    const sortByNameBtn = createSortButton('🔤 五十音順', 'name', this.currentSortOrder === 'name');

    centerControls.appendChild(sortByIdBtn);
    centerControls.appendChild(sortByNameBtn);

    // === 右側コントロール（ページネーション） ===
    const rightControls = document.createElement('div');
    rightControls.className = 'nav-controls-right';
    Object.assign(rightControls.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });

    // ページネーションボタン
    const createPageButton = (text, action, disabled = false) => {
      const btn = document.createElement('button');
      btn.className = 'btn-pagination';
      btn.textContent = text;
      btn.disabled = disabled;
      
      const baseStyle = {
        background: disabled ? 
          'linear-gradient(135deg, #6c757d, #5a6268)' : 
          'linear-gradient(135deg, #4a90e2, #357abd)',
        color: disabled ? '#adb5bd' : 'white',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '8px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        transition: 'all 0.3s ease',
        boxShadow: disabled ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.2)'
      };
      
      Object.assign(btn.style, baseStyle);
      
      if (!disabled) {
        btn.addEventListener('mouseenter', () => {
          Object.assign(btn.style, {
            background: 'linear-gradient(135deg, #357abd, #2e6da4)',
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
          });
        });
        
        btn.addEventListener('mouseleave', () => {
          Object.assign(btn.style, baseStyle);
        });
      }
      
      btn.addEventListener('click', action);
      return btn;
    };

    const prevBtn = createPageButton('⬅️ 前のページ', () => this.changePage(this.currentPage - 1), this.currentPage === 0);
    
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    Object.assign(pageInfo.style, {
      background: 'rgba(255, 255, 255, 0.15)',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '6px',
      fontWeight: '600',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      minWidth: '80px',
      textAlign: 'center'
    });
    pageInfo.textContent = `${this.currentPage + 1} / ${this.totalPages}`;
    
    const nextBtn = createPageButton('次のページ ➡️', () => this.changePage(this.currentPage + 1), this.currentPage >= this.totalPages - 1);

    rightControls.appendChild(prevBtn);
    rightControls.appendChild(pageInfo);
    rightControls.appendChild(nextBtn);

    // 全体を組み立て
    navDiv.appendChild(leftControls);
    navDiv.appendChild(centerControls);
    navDiv.appendChild(rightControls);

    // === カードグリッドエリア ===
    const cardGrid = document.createElement('div');
    cardGrid.className = 'monster-card-grid';
    Object.assign(cardGrid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      padding: '16px',
      margin: '0 16px'
    });

    // 現在のページのモンスターカードを生成
    const startIndex = this.currentPage * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageIds = this.filteredMonsterIds.slice(startIndex, endIndex);

    pageIds.forEach(id => {
      const monsterData = getMonsterById(id);
      if (monsterData) {
        monsterData.collected = this.dexSet.has(id);
        const card = createCard(monsterData, {
          showUncollected: this.showUncollectedSilhouette,
          isFavorite: this.favoritesSet.has(id),
          onToggleFavorite: (monsterId, next) => {
            if (next) this.favoritesSet.add(monsterId);
            else this.favoritesSet.delete(monsterId);
            saveFavorites(this.favoritesSet);
            this.applyFiltersAndSort();
            this.renderPage();
            this.savePreferences();
          }
        });
        if (!card) return;
    
        Object.assign(card.style, {
          background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.8), rgba(160, 82, 45, 0.6))',
          border: '2px solid #8B4513',
          borderRadius: '12px',
          padding: '12px',
          textAlign: 'center',
          cursor: monsterData.collected ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
          color: '#fff',
          position: 'relative'
        });
    
        if (monsterData.collected) {
          card.addEventListener('mouseenter', () => {
            Object.assign(card.style, {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)'
            });
          });
          
          card.addEventListener('mouseleave', () => {
            Object.assign(card.style, {
              transform: 'translateY(0)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
            });
          });
        }
        
        cardGrid.appendChild(card);
      }
    });

    // コンテナに全て追加
    this.container.appendChild(statsDiv);
    this.container.appendChild(navDiv);
    this.container.appendChild(cardGrid);
  },
  
  /** ページを切り替える */
  changePage(newPage) {
    if (newPage >= 0 && newPage < this.totalPages) {
      this.currentPage = newPage;
      this.renderPage();
      this.savePreferences();
      publish('playSE', 'decide');
    }
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    publish('stopBGM', 0.2);
    // DOM要素を削除
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    // モーダルが残っている場合は削除
    const modal = document.querySelector('.monster-modal');
    if (modal) {
      modal.remove();
    }
    
    // イベント解除
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
    }

    // キャンバスの可視状態を復元（KanjiDexと同様）
    if (this.canvas) {
      this.canvas.style.visibility = this._prevCanvasVisibility ?? '';
      this.canvas.style.pointerEvents = this._prevCanvasPointer ?? '';
    }
    
    this.canvas = null;
  },
  
  // この画面はDOMで完結するため、updateとrenderは空でOK
  update(dt) {
    // 背景（書斎風）を描画（KanjiDexと同様）
    if (this.canvas && this.canvas.getContext) {
      const ctx = this.canvas.getContext('2d');
      
      // 背景（書斎風）を描画
      ctx.fillStyle = '#2c1810';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // 古文書風の背景テクスチャ
      ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          if ((i + j) % 2 === 0) {
            ctx.fillRect(i * 80, j * 60, 40, 30);
          }
        }
      }
    }
  },
  
  render() {
    this.update(0);
  }
};

export default monsterDexState;