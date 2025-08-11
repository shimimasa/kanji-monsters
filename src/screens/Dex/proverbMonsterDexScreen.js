// js/screens/Dex/proverbMonsterDexScreen.js
import { loadDex, loadSeenMonsters, markAsSeen, isNewMonster } from '../../models/proverbMonsterDex.js';
import { getMonsterById, getAllMonsterIds } from '../../loaders/dataLoader.js';
import { publish } from '../../core/eventBus.js';

// --- グローバルスコープにあったヘルパー関数を、このファイル内に移動 ---

// 漢検級別フォルダマッピング
const gradeFolderMap = {
  7: 'proverbs',  // 4級
  8: 'proverbs',  // 3級
  9: 'proverbs',  // 準2級
  10: 'proverbs', // 2級
};

// 漢検級マッピング（学年から級への変換）
const kankenLevelMap = {
  7: '4級',
  8: '3級',
  9: '準2級',
  10: '2級'
};

// 地域マッピング
const regionMap = {
  7: 'アジア',
  8: 'ヨーロッパ',
  9: 'アメリカ大陸',
  10: 'アフリカ大陸'
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
  card.classList.add('proverb-monster-card'); // ことわざモンスター用のクラスを追加

  if (!monster.collected) {
    card.classList.add('locked');
  }

  // カードクリック時のモーダル表示処理
  card.addEventListener('click', () => {
    if (monster.collected) {
      showMonsterModal(monster);
      // モンスターを「確認済み」として記録
      markAsSeen(monster.id);
      // NEWバッジを削除
      const newBadge = card.querySelector('.new-badge');
      if (newBadge) {
        newBadge.remove();
      }
    }
  });

  const img = document.createElement('img');
  const folder = gradeFolderMap[monster.grade] || 'proverbs';
  const thumbPath = `/assets/images/proverbs/thumb/${monster.id}.webp`;
  img.dataset.thumb = thumbPath;
  img.alt = monster.name;
  card.appendChild(img);

  const nameEl = document.createElement('p');
  nameEl.textContent = monster.collected ? monster.name : '？？？';
  nameEl.classList.add('monster-name');
  card.appendChild(nameEl);

  // ことわざの表示を追加
  const proverbEl = document.createElement('p');
  proverbEl.textContent = monster.collected ? (monster.proverb || '不明') : '？？？';
  proverbEl.classList.add('monster-proverb');
  card.appendChild(proverbEl);

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
  modal.classList.add('proverb-monster-modal'); // ことわざモンスター用のクラスを追加
  
  const modalContent = document.createElement('div');
  modalContent.classList.add('modal-content');
  
  // 閉じるボタン
  const closeBtn = document.createElement('button');
  closeBtn.classList.add('modal-close');
  closeBtn.textContent = '×';
  closeBtn.onclick = () => modal.remove();
  
  // モンスター画像
  const img = document.createElement('img');
  const folder = gradeFolderMap[monster.grade] || 'proverbs';
  img.src = `/assets/images/proverbs/full/${monster.id}.webp`;
  img.alt = monster.name;
  img.classList.add('modal-monster-image');
  
  // モンスター情報
  const info = document.createElement('div');
  info.classList.add('monster-info');
  info.innerHTML = `
    <h2>${monster.name}</h2>
    <p><strong>漢検級:</strong> ${kankenLevelMap[monster.grade] || '不明'}</p>
    <p><strong>地域:</strong> ${regionMap[monster.grade] || '不明'}</p>
    <p><strong>ことわざ:</strong> ${monster.proverb || '不明'}</p>
    <p><strong>読み:</strong> ${monster.reading || '不明'}</p>
    <p><strong>意味:</strong> ${monster.meaning || '詳細情報なし'}</p>
    <p><strong>例文:</strong> ${monster.example || '例文なし'}</p>
  `;
  
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(img);
  modalContent.appendChild(info);
  modal.appendChild(modalContent);
  
  // モーダル外クリックで閉じる
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
  
  document.body.appendChild(modal);
  publish('playSE', 'decide');
}
// --- ヘルパー関数の定義ここまで ---


const proverbMonsterDexState = {
  canvas: null,
  dexSet: null,
  seenSet: null,
  allMonsterIds: [],
  filteredMonsterIds: [], // フィルタリング後のモンスターID配列
  
  // ページ管理用の状態を追加
  itemsPerPage: 15, // 1ページに表示する数 (3行x5列)
  currentPage: 0,
  totalPages: 0,

  // フィルタリング・ソート用の状態
  currentRegionFilter: 'all', // 'all', 7, 8, 9, 10
  currentSortOrder: 'id', // 'id' (図鑑番号順), 'name' (五十音順)

  /** 画面表示時の初期化 */
  enter(canvas) {
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.canvas.style.display = 'none'; // Canvasは使わないので非表示

    // データの読み込み
    this.dexSet = loadDex();
    this.seenSet = loadSeenMonsters();
    this.allMonsterIds = getAllMonsterIds().filter(id => id.startsWith('PRV-')); // PRV-で始まるIDのみ
    
    // 初期状態では全てのモンスターを表示
    this.applyFiltersAndSort();
    this.currentPage = 0; // 常に最初のページから表示

    // ページを描画
    this.renderPage();
  },

  /** 地域ごとのコンプリート状況を計算 */
  calculateRegionCompletion() {
    const regionCompletion = {};
    
    // 各地域（漢検級）ごとにモンスターを分類
    for (let grade = 7; grade <= 10; grade++) {
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
    // 地域フィルタリング
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

    this.filteredMonsterIds = filtered;
    this.totalPages = Math.ceil(this.filteredMonsterIds.length / this.itemsPerPage);
  },

  /** 現在のページを描画する（DOM操作） */
  renderPage() {
    // monsterDexScreen と同じ既存コンテナを使用して、同じグリッドCSSを適用する
    const container = document.getElementById('monsterContainer');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'grid';

    // 地域コンプリート状況を計算
    const regionCompletion = this.calculateRegionCompletion();

    // --- 収集率表示エリアを作成 ---
    const collectionStats = document.createElement('div');
    collectionStats.className = 'collection-stats';
    
    const totalCollected = this.dexSet.size;
    const totalMonsters = this.allMonsterIds.length;
    const collectionRate = totalMonsters > 0 ? Math.round((totalCollected / totalMonsters) * 100) : 0;
    
    const statsText = document.createElement('div');
    statsText.className = 'stats-text';
    statsText.textContent = `ことわざモンスター収集率: ${collectionRate}% (${totalCollected} / ${totalMonsters})`;
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = `${collectionRate}%`;
    
    progressBar.appendChild(progressFill);
    collectionStats.appendChild(statsText);
    collectionStats.appendChild(progressBar);
    container.appendChild(collectionStats);

    // --- ページナビゲーションUIを作成 ---
    const nav = document.createElement('div');
    nav.className = 'dex-navigation';

    // 戻るボタン
    const backToMenuButton = document.createElement('button');
    backToMenuButton.textContent = 'ステージ選択へ';
    backToMenuButton.onclick = () => publish('changeScreen', 'worldStageSelect');

    // 地域フィルタードロップダウン（コンプリート報酬アイコン付き）
    const regionFilter = document.createElement('select');
    regionFilter.className = 'region-filter';
    
    let optionsHTML = '<option value="all">すべて表示</option>';
    for (let grade = 7; grade <= 10; grade++) {
      const regionName = regionMap[grade];
      const kankenLevel = kankenLevelMap[grade];
      const completion = regionCompletion[grade];
      const crownIcon = completion.isComplete ? ' 👑' : '';
      optionsHTML += `<option value="${grade}">${regionName}（${kankenLevel}）${crownIcon}</option>`;
    }
    regionFilter.innerHTML = optionsHTML;
    
    regionFilter.value = this.currentRegionFilter;
    regionFilter.onchange = (e) => {
      this.currentRegionFilter = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
      this.applyFiltersAndSort();
      this.currentPage = 0; // 1ページ目にリセット
      this.renderPage();
      publish('playSE', 'decide');
    };

    // ソートボタン
    const sortByIdButton = document.createElement('button');
    sortByIdButton.textContent = '図鑑番号順';
    sortByIdButton.className = this.currentSortOrder === 'id' ? 'sort-active' : '';
    sortByIdButton.onclick = () => {
      this.currentSortOrder = 'id';
      this.applyFiltersAndSort();
      this.currentPage = 0;
      this.renderPage();
      publish('playSE', 'decide');
    };

    const sortByNameButton = document.createElement('button');
    sortByNameButton.textContent = '五十音順';
    sortByNameButton.className = this.currentSortOrder === 'name' ? 'sort-active' : '';
    sortByNameButton.onclick = () => {
      this.currentSortOrder = 'name';
      this.applyFiltersAndSort();
      this.currentPage = 0;
      this.renderPage();
      publish('playSE', 'decide');
    };

    // ページネーション
    const prevButton = document.createElement('button');
    prevButton.textContent = '前のページ';
    prevButton.disabled = this.currentPage === 0;
    prevButton.onclick = () => this.changePage(this.currentPage - 1);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `${this.currentPage + 1} / ${this.totalPages} ページ`;

    const nextButton = document.createElement('button');
    nextButton.textContent = '次のページ';
    nextButton.disabled = this.currentPage >= this.totalPages - 1;
    nextButton.onclick = () => this.changePage(this.currentPage + 1);

    // ナビゲーション要素を配置
    const controlsLeft = document.createElement('div');
    controlsLeft.className = 'nav-controls-left';
    controlsLeft.appendChild(backToMenuButton);
    controlsLeft.appendChild(regionFilter);

    const controlsCenter = document.createElement('div');
    controlsCenter.className = 'nav-controls-center';
    controlsCenter.appendChild(sortByIdButton);
    controlsCenter.appendChild(sortByNameButton);

    const controlsRight = document.createElement('div');
    controlsRight.className = 'nav-controls-right';
    controlsRight.appendChild(prevButton);
    controlsRight.appendChild(pageInfo);
    controlsRight.appendChild(nextButton);

    nav.appendChild(controlsLeft);
    nav.appendChild(controlsCenter);
    nav.appendChild(controlsRight);
    container.appendChild(nav);
    // --- ナビゲーションUIここまで ---

    // --- 現在のページのカードを生成 ---
    const startIndex = this.currentPage * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageIds = this.filteredMonsterIds.slice(startIndex, endIndex);

    pageIds.forEach(id => {
      const monsterData = getMonsterById(id);
      if (monsterData) {
        monsterData.collected = this.dexSet.has(id); // 収集済みか判定
        const card = createCard(monsterData);
        container.appendChild(card);
      }
    });
  },
  
  /** ページを切り替える */
  changePage(newPage) {
    if (newPage >= 0 && newPage < this.totalPages) {
      this.currentPage = newPage;
      this.renderPage(); // ページを再描画
      publish('playSE', 'decide');
    }
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    // カードUIを非表示に戻す
    const container = document.getElementById('monsterContainer');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
    // モーダルが残っている場合は削除
    const modal = document.querySelector('.proverb-monster-modal');
    if (modal) {
      modal.remove();
    }
    // Canvasを再表示
    if (this.canvas) {
      this.canvas.style.display = '';
    }
  },
  
  // この画面はDOMで完結するため、updateとrenderは空でOK
  update(dt) {},
  render() {}
};

export default proverbMonsterDexState;

