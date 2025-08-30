// js/screens/monsterDexScreen.js
import { loadDex, loadSeenMonsters, markAsSeen, isNewMonster } from '../../models/monsterDex.js';
import { getMonsterById, getAllMonsterIds } from '../../loaders/dataLoader.js';
import { publish } from '../../core/eventBus.js';
import { gameState } from '../../core/gameState.js';

// --- グローバルスコープにあったヘルパー関数を、このファイル内に移動 ---

// 学年別フォルダマッピング
const gradeFolderMap = {
  1: 'grade1-hokkaido',
  2: 'grade2-touhoku',
  3: 'grade3-kantou',
  4: 'grade4-chuubu',
  5: 'grade5-kinki',
  6: 'grade6-chuugoku',
};

// 地方マッピング（学年から地方名への変換）
const regionMap = {
  1: '北海道',
  2: '東北',
  3: '関東',
  4: '中部',
  5: '近畿',
  6: '中国'
};

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

// モンスターカードを生成する関数
function createCard(monster) {
  const card = document.createElement('div');
  card.classList.add('monster-card');
  
  // 捕獲済みかどうかで判定
  if (!monster.collected) {
    // シルエットではなく、非表示または「？」表示
    return null;  // または未取得用のカードを返す
  }

      // カードクリック時のモーダル表示処理
  card.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (monster.collected) {
      showMonsterModal(monster);
      // モンスターを「確認済み」として記録
      markAsSeen(monster.id);
      // NEWバッジを削除
      const newBadge = card.querySelector('.new-badge');
      if (newBadge) newBadge.remove();
    }
  });

    const img = document.createElement('img');
    const folder = gradeFolderMap[monster.grade] || gradeFolderMap[1];
    const thumbPath = `/assets/images/monsters/thumb/${folder}/${monster.id}.webp`;
    img.dataset.thumb = thumbPath;
    img.alt = monster.name;
    card.appendChild(img);

    const nameEl = document.createElement('p');
    nameEl.textContent = monster.collected ? monster.name : '？？？';
    nameEl.classList.add('monster-name');
    card.appendChild(nameEl);

    // 生息地（都道府県）の表示を追加
    const prefectureEl = document.createElement('p');
    prefectureEl.textContent = monster.collected ? (monster.prefecture || regionMap[monster.grade] || '不明') : '？？？';
    prefectureEl.classList.add('monster-prefecture');
    card.appendChild(prefectureEl);

    // NEWバッジの追加
    if (isNewMonster(monster.id)) {
      const newBadge = document.createElement('div');
      newBadge.classList.add('new-badge');
      newBadge.textContent = 'NEW!';
      card.appendChild(newBadge);
    }
  
    observer.observe(card); // 遅延読み込みの対象として監視
    return card;
}

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

  // 閉じるボタン（← これが欠けていた）
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

  // モンスター画像
  const img = document.createElement('img');
  const folder = gradeFolderMap[monster.grade] || gradeFolderMap[1];
  img.src = `/assets/images/monsters/thumb/${folder}/${monster.id}.webp`;
  img.alt = monster.name;
  img.classList.add('modal-monster-image');

  // 情報
  const info = document.createElement('div');
  info.classList.add('monster-info');
  info.innerHTML = `
    <h2>${monster.name}</h2>
    <p><strong>都道府県:</strong> ${monster.prefecture || '不明'}</p>
    <p><strong>カテゴリ:</strong> ${monster.category || '不明'}</p>
    <p><strong>生息地:</strong> ${monster.habitat || '不明'}</p>
    <p><strong>説明:</strong> ${monster.desc || '—'}</p>
    <p><strong>豆知識:</strong> ${monster.trivia || '—'}</p>
    <p><strong>決め台詞:</strong> ${monster.catchphrase || '—'}</p>
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
  
  // ページ管理用の状態を追加
  itemsPerPage: 15, // 1ページに表示する数 (3行x5列)
  currentPage: 0,
  totalPages: 0,

  // フィルタリング・ソート用の状態
  currentRegionFilter: 'all', // 'all', 1, 2, 3, 4, 5, 6
  currentSortOrder: 'id', // 'id' (図鑑番号順), 'name' (五十音順)

  // DOM管理用プロパティ
  container: null,

  enter(canvas) {
    this.canvas = canvas || document.getElementById('gameCanvas');
    
    // キャンバスを不可視化（KanjiDexと同様）
    if (this.canvas) {
      this._prevCanvasVisibility = this.canvas.style.visibility;
      this._prevCanvasPointer = this.canvas.style.pointerEvents;
      this.canvas.style.visibility = 'hidden';
      this.canvas.style.pointerEvents = 'none';
    }

    // データの読み込み
    this.dexSet = loadDex();
    this.seenSet = loadSeenMonsters();
    // 小学生6学年のみ（世界編・ことわざは除外）
    this.allMonsterIds = getAllMonsterIds().filter(id => {
      const m = getMonsterById(id);
      const idStr = String(id);
      const isWorld = (m && m.grade >= 7) || idStr.startsWith('PRV-');
      return m && !isWorld;
    });

    // 初期状態では全てのモンスターを表示
    this.applyFiltersAndSort();
    this.currentPage = 0;

    // DOMコンテナを作成
    this.createDOMContainer();
    
    // ページを描画
    this.renderPage();

    // キーボードイベント（KanjiDexと同様）
    this._keyHandler = e => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        this.changePage(this.currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        this.changePage(this.currentPage + 1);
      }
    };
    window.addEventListener('keydown', this._keyHandler);
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

  /** 地方ごとのコンプリート状況を計算 */
  calculateRegionCompletion() {
    const regionCompletion = {};
    
    // 各地方（学年）ごとにモンスターを分類
    for (let grade = 1; grade <= 6; grade++) {
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

  /** フィルタリングとソートを適用 */
  applyFiltersAndSort() {
    // 地方フィルタリング
    let filtered = this.allMonsterIds;
    if (this.currentRegionFilter !== 'all') {
      filtered = this.allMonsterIds.filter(id => {
        const monster = getMonsterById(id);
        return monster && monster.grade === this.currentRegionFilter;
      });
    }

    // ソート
    if (this.currentSortOrder === 'name') {
      // 五十音順
      filtered.sort((a, b) => {
        const monsterA = getMonsterById(a);
        const monsterB = getMonsterById(b);
        if (!monsterA || !monsterB) return 0;
        return monsterA.name.localeCompare(monsterB.name, 'ja');
      });
    } else {
      // 図鑑番号順（デフォルト）
      filtered.sort((a, b) => a.localeCompare(b));
    }

    // 捕獲済みのみ表示
    filtered = filtered.filter(id => this.dexSet.has(id));

    this.filteredMonsterIds = filtered;
    this.totalPages = Math.ceil(this.filteredMonsterIds.length / this.itemsPerPage);
  },

  /** 現在のページを描画する（KanjiDexスタイルに統一） */
  renderPage() {
    if (!this.container) return;

    // 既存の要素を全てクリア
    this.container.innerHTML = '';

    // 地方コンプリート状況を計算
    const regionCompletion = this.calculateRegionCompletion();

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
    
    const totalCollected = this.dexSet.size;
    const totalMonsters = this.allMonsterIds.length;
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
      const targetScreen = gameState.previousScreen || 'stageSelect';
      publish('changeScreen', targetScreen);
    });
    leftControls.appendChild(backButton);

    // 地方セレクト
    const regionLabel = document.createElement('span');
    regionLabel.className = 'monster-region-label';
    regionLabel.textContent = '地方：';
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
    for (let grade = 1; grade <= 6; grade++) {
      const regionName = regionMap[grade];
      const completion = regionCompletion[grade];
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
            const card = createCard(monsterData);
            if (!card) return; // 未捕獲は非表示（シルエット廃止）
    
            // カードのスタイルを統一（KanjiDexと同様）
            Object.assign(card.style, {
              background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.8), rgba(160, 82, 45, 0.6))',
              border: '2px solid #8B4513',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center',
              cursor: monsterData.collected ? 'pointer' : 'default',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
              color: '#fff'
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
      publish('playSE', 'decide');
    }
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
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