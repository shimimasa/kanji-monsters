// src/audioManager.js
// シンプル & 拡張しやすい Audio 管理クラス（ES Modules）
//
// 使い方例：
// import { AudioManager } from './audioManager.js';
//
// const audio = new AudioManager();
// audio.playBGM('title');
// audio.playSE('attack');
// audio.fadeToBGM('battle', 1.5);   // 1.5 秒クロスフェード
// audio.setMasterVolume(0.6);

export class AudioManager {
    /** @type {HTMLAudioElement|null} 現在再生中の BGM */
    #currentBGM = null;
    /** @type {number} 0.0–1.0 のマスターボリューム */
    #masterVolume = 1;
    /** @type {number} 0.0–1.0 のBGM個別音量 */
    #bgmVolume = 0.2; // デフォルト値を0.7に設定
    /** @type {number} 0.0–1.0 のSE個別音量 */
    #seVolume  = 0.2; // デフォルト値を0.7に設定
    /** @type {string[]|null} このブラウザで再生できる拡張子の優先順（初回に判定してキャッシュ） */
    #extOrderCache = null;

    constructor() {
      // 初期化時にローカルストレージから音量設定を読み込む
      this.loadVolumeSettings();
    }

  /**
    * 現在のマスターボリュームを返す
    */
   getMasterVolume() {
     return this.#masterVolume;
   }
  
    /** ─────────────────────────────────────
     *  アセット定義：ファイル名をまとめておくだけ
     *  追加・変更はここを編集するだけで OK
     *  ───────────────────────────────────── */
    static FILES = {
      bgm: {
        title:   '/assets/audio/bgm_title.mp3',
        battle:  '/assets/audio/bgm_battle.mp3',
        victory: '/assets/audio/bgm_victory.mp3',
        gameover: '/assets/audio/bgm_gameover.mp3',
        yomitomo: '/assets/audio/bgm_yomitomo.mp3',

        // ステージ別BGMを追加
        // NOTE: 北海道A/B.mp3 はリポジトリに存在せず無音になっていたため、
        // 専用曲が用意されるまで汎用バトルBGMを暫定割当（要: 北海道用音源の追加）
        hokkaido: '/assets/audio/bgm_battle.mp3',
        hokkaido_a: '/assets/audio/bgm_battle.mp3',
        hokkaido_b: '/assets/audio/bgm_battle.mp3',
            
        tohoku_a: '/assets/audio/東北A.mp3',
        tohoku_b: '/assets/audio/東北B.mp3',
    
        kanto_a: '/assets/audio/関東A.mp3',
        kanto_b: '/assets/audio/関東B.mp3',
    
        chubu_a: '/assets/audio/中部A.mp3',
        chubu_b: '/assets/audio/中部B.mp3',
    
        kinki_a: '/assets/audio/近畿A.mp3',
        kinki_b: '/assets/audio/近畿B.mp3',
    
        chugoku_a: '/assets/audio/中国A.mp3',
        chugoku_b: '/assets/audio/中国B.mp3',
    
        asia_a: '/assets/audio/アジアA.mp3',
        asia_b: '/assets/audio/アジアB.mp3',
    
        europe_a: '/assets/audio/ヨーロッパA.mp3',
        europe_b: '/assets/audio/ヨーロッパB.mp3',
    
        america_a: '/assets/audio/アメリカA.mp3',
        america_b: '/assets/audio/アメリカB.mp3',
        // NOTE: アメリカA2.mp3 は存在しないため実在するBに暫定割当
        america_a2: '/assets/audio/アメリカB.mp3',
    
        africa_a: '/assets/audio/アフリカ大陸A.mp3',
        africa_b: '/assets/audio/アフリカ大陸B.mp3',
    
        Africa: '/assets/audio/アフリカ大陸A.mp3',



        boss: '/assets/audio/boss.mp3'
      },
      se: {
        appear:  '/assets/audio/se_appear.mp3',
        attack:  '/assets/audio/se_attack.mp3',
        damage:  '/assets/audio/se_damage.mp3',
        heal:    '/assets/audio/se_heal.mp3',
        correct: '/assets/audio/se_correct.mp3',
        wrong:   '/assets/audio/se_wrong.mp3',
        decide:  '/assets/audio/se_decide.mp3',
        defeat:  '/assets/audio/se_defeat.mp3',
        // ← 追加
        weak:    '/assets/audio/se_weak.mp3',
        master:  '/assets/audio/se_master.mp3',
        shield1: '/assets/audio/se_shield1.mp3',
        shield2: '/assets/audio/se_shield2.mp3',
        shield3: '/assets/audio/se_shield3.mp3',
        levelUp: '/assets/audio/se_level.mp3'
      }
    };

    /** ─────────────────────
     *  ステージBGMの「実ファイル名の先頭表記」対応表
     *
     *  stageId の正史は小文字（asia_area1）だが、世界編の音源ファイルだけは
     *  先頭大文字（Asia_area1_a.ogg）で保存されている。
     *  本番ホスティング（Vercel / Firebase）も vite preview も大文字小文字を区別するため、
     *  小文字のまま組み立てると世界ステージの音源だけが見つからず、
     *  SPA の rewrite で index.html が返って無音になっていた。
     *  ここで canonical(小文字) → 実ファイル表記 を橋渡しする。
     *  ───────────────────── */
    static DISK_PREFIXES = {
      asia:    'Asia',
      europe:  'Europe',
      america: 'America',
      africa:  'Africa',
    };
  
    /*───────────────────────
      BGM 再生
    ───────────────────────*/
    /**
     * BGM 再生。すでに同じ曲の場合は何もしない
     * @param {'title'|'battle'|'victory'|'defeat'} key
     * @param {boolean} [loop=true]
     */
    playBGM(key, loop = true) {
      const bases = this.resolveBgmBases(key); // 拡張子なしのベースURL候補（優先順）
      if (!bases.length) return console.warn(`BGM "${key}" は定義されていません`);

      // 既存BGMと同じキーで「再生に成功済み」ならスキップ、停止中なら再開のみ
      // （再生できないままの要素は、同じキーでも作り直す）
      if (this.#currentBGM?.dataset?.key === key && this.#currentBGM.dataset.resolved === '1') {
        if (this.#currentBGM.paused) {
          this.#currentBGM.loop = loop;
          this.#currentBGM.volume = this.#masterVolume * this.#bgmVolume;
          this.#currentBGM.play().catch(err => { if (err?.name !== 'AbortError') console.error(err); });
        }
        return;
      }

      if (this.#currentBGM) {
        this.#currentBGM.pause();
        this.#currentBGM.currentTime = 0;
        this.#currentBGM = null;
      }

      // 実ファイルを順に試して再生
      const bgm = new Audio();
      bgm.dataset.key = key;
      bgm.loop = loop;
      bgm.volume = this.#masterVolume * this.#bgmVolume;

      this.#currentBGM = bgm;
      this.#playWithFallback(bgm, bases);
    }

    /**
     * ベースURL候補 × 拡張子候補 を順に試して再生する。
     * 最初に再生できたものを採用し、その要素に resolved マークを付ける。
     */
    async #playWithFallback(audioEl, bases) {
      const order = this.#extOrder();
      for (const base of bases) {
        for (const ext of order) {
          const src = encodeURI(`${base}.${ext}`);
          try {
            audioEl.src = src;
            await audioEl.play();
            audioEl.dataset.resolved = '1'; // 再生開始に成功
            return;
          } catch (err) {
            if (err?.name === 'AbortError') return;      // 他の曲へ切替済み
            if (err?.name === 'NotAllowedError') return; // 自動再生ブロック（src は保持して待つ）
            // 次の候補へ
          }
        }
      }
      console.warn('音声の再生に失敗しました:', bases, order);
    }

    /**
     * このブラウザで再生できる拡張子の優先順を返す（初回のみ判定してキャッシュ）。
     * iPad/Safari は ogg 非対応なので m4a を先に試す。
     */
    #extOrder() {
      if (this.#extOrderCache) return this.#extOrderCache;
      const order = ['ogg', 'm4a', 'mp3'];
      try {
        const probe = document.createElement('audio');
        const mime = {
          ogg: 'audio/ogg; codecs="vorbis"',
          m4a: 'audio/mp4; codecs="mp4a.40.2"',
          mp3: 'audio/mpeg',
        };
        const score = ext => {
          const s = probe.canPlayType(mime[ext]);
          return s === 'probably' ? 2 : s === 'maybe' ? 1 : 0;
        };
        order.sort((a, b) => score(b) - score(a)); // 同点なら元の順序を維持（安定ソート）
      } catch {}
      this.#extOrderCache = order;
      return order;
    }
    /**
     * BGM 停止
     * @param {number} duration フェードアウト秒数。0 なら即停止
     */
    async stopBGM(duration = 0) {
      if (!this.#currentBGM) return;
      await this.#fadeOut(this.#currentBGM, duration);
      this.#currentBGM.pause();
      this.#currentBGM.currentTime = 0;
      this.#currentBGM = null;
    }
  
    /*───────────────────────
      SE 再生（多重再生 OK）
    ───────────────────────*/
    /**
     * 効果音を再生
     * @param {'appear'|'attack'|'damage'|'heal'|'defeat'|'correct'|'wrong'} key
     */
    playSE(key) {
      const base = this.resolveSeBase(key);
      if (!base) return console.warn(`SE "${key}" は定義されていません`);
      const se = new Audio();
      se.volume = this.#masterVolume * this.#seVolume;
      this.#playWithFallback(se, [base]);
    }
  
    /*───────────────────────
      共通ユーティリティ
    ───────────────────────*/
    /**
     * マスターボリューム (0–1)
     * BGM / SE どちらにも即反映
     */
    setMasterVolume(value) {
      this.#masterVolume = Math.max(0, Math.min(1, value));
      if (this.#currentBGM) {
        this.#currentBGM.volume = this.#masterVolume * this.#bgmVolume;
      }
    }
  
    // 内部：フェードアウト
    #fadeOut(audio, duration) {
      return new Promise(res => {
        if (duration <= 0) return res();
        let t = duration, startVol = audio.volume;
        const step = () => {
          t -= 0.016;
          audio.volume = Math.max(0, (t / duration) * startVol);
          if (t <= 0) return res();
          requestAnimationFrame(step);
        };
        step();
      });
    }
  
        // 内部：フェードイン
        #fadeIn(audio, duration) {
          return new Promise(res => {
            if (duration <= 0) return res();
            let t = 0;
            audio.volume = 0;
            const targetVolume = this.#masterVolume * this.#bgmVolume;
            const step = () => {
              t += 0.016;
              audio.volume = Math.min(targetVolume, (t / duration) * targetVolume);
              if (t >= duration) return res();
              requestAnimationFrame(step);
            };
            step();
          });
        }
    
        /**
         * BGMキーから「拡張子なしのベースURL」の候補を優先順に返す。
         * 実ファイルの表記ゆれ（世界編は先頭大文字）と、専用音源が無い地域の
         * どちらも無音にせず吸収するためのフォールバック列。
         * @returns {string[]}
         */
        resolveBgmBases(key) {
          const bases = [];
          const push = (value) => {
            if (!value) return;
            const base = value.replace(/\.(ogg|mp3|m4a)$/i, '');
            if (!bases.includes(base)) bases.push(base);
          };

          const map = (AudioManager.FILES && AudioManager.FILES.bgm) || {};
          if (map[key]) {
            push(map[key]);
            return bases;
          }

          // area系: xxx_areaN[_a|_b]
          const m = /^(.+?)_(area\d+)(?:_(a|b))?$/i.exec(String(key || ''));
          if (m) {
            const regionRaw = m[1];
            const region    = regionRaw.toLowerCase();
            const area      = m[2].toLowerCase();
            // a/b 指定が無ければ毎回ランダム（従来どおり）
            const ab = (m[3] || (Math.random() < 0.5 ? 'a' : 'b')).toLowerCase();

            // ① 実ファイル表記（世界編は先頭大文字）
            const disk = AudioManager.DISK_PREFIXES[region];
            if (disk) push(`/assets/audio/${disk}_${area}_${ab}`);
            // ② 渡されたままの表記 / ③ 全部小文字
            push(`/assets/audio/${regionRaw}_${area}_${ab}`);
            push(`/assets/audio/${region}_${area}_${ab}`);
            // ④ ステージ個別の曲が無い地域は、地域の汎用BGMへ
            push(map[`${region}_${ab}`] || map[`${region}_a`]);
            // ⑤ 最後の砦（必ず存在する汎用バトルBGM）
            push(map.battle);
            return bases;
          }

          // その他はキー名そのまま（例: title → /assets/audio/bgm_title）
          push(`/assets/audio/${key}`);
          return bases;
        }

        /** 後方互換: 最優先の候補だけを返す */
        resolveBgmBase(key) {
          return this.resolveBgmBases(key)[0] || '';
        }

        resolveSeBase(key) {
          const map = (AudioManager.FILES && AudioManager.FILES.se) || {};
          const mapped = map[key];
          if (mapped) {
            return mapped.replace(/\.(ogg|mp3|m4a)$/i, '');
          }
          return `/assets/audio/${key}`;
        }  


     /*───────────────────────
      BGM音量を設定 (0–1)
    ───────────────────────*/
     
    setBGMVolume(value) {
      this.#bgmVolume = Math.max(0, Math.min(1, value));
      if (this.#currentBGM) {
        this.#currentBGM.volume = this.#masterVolume * this.#bgmVolume;
      }
      // ローカルストレージに保存
      localStorage.setItem('bgmVolume', this.#bgmVolume.toString());
      console.log('BGM音量設定:', this.#bgmVolume);
    }

    /**
     * BGM音量を取得
     */
    getBGMVolume() {
      return this.#bgmVolume;
    }

    /**
     * SE音量を設定 (0–1)
     */
    setSEVolume(value) {
      this.#seVolume = Math.max(0, Math.min(1, value));
      // ローカルストレージに保存
      localStorage.setItem('seVolume', this.#seVolume.toString());
      console.log('SE音量設定:', this.#seVolume);
    }

    /**
     * SE音量を取得
     */
    getSEVolume() {
      return this.#seVolume;
    }

    /**
     * 初期化時にローカルストレージから音量設定を読み込む
     */
    loadVolumeSettings() {
      const savedBgmVolume = localStorage.getItem('bgmVolume');
      const savedSeVolume = localStorage.getItem('seVolume');
      
      if (savedBgmVolume !== null) {
        this.#bgmVolume = parseFloat(savedBgmVolume);
      }
      
      if (savedSeVolume !== null) {
        this.#seVolume = parseFloat(savedSeVolume);
      }
      
      console.log('音量設定読み込み - BGM:', this.#bgmVolume, 'SE:', this.#seVolume);
    }
}
  