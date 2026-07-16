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

    constructor() {
      // 初期化時にローカルストレージから音量設定を読み込む
      this.loadVolumeSettings();
    }

    setMasterVolume(value) {
      this.#masterVolume = Math.max(0, Math.min(1, value));
      if (this.#currentBGM) {
        this.#currentBGM.volume = this.#masterVolume * this.#bgmVolume;
      }
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
  
    /*───────────────────────
      BGM 再生
    ───────────────────────*/
    /**
     * BGM 再生。すでに同じ曲の場合は何もしない
     * @param {'title'|'battle'|'victory'|'defeat'} key
     * @param {boolean} [loop=true]
     */
    playBGM(key, loop = true) {
      const base = this.resolveBgmBase(key); // 拡張子なしのベースURLを取得
      if (!base) return console.warn(`BGM "${key}" は定義されていません`);

      // 既存BGMと同じキーかつ再生中であればスキップ、停止中なら再開のみ
      if (this.#currentBGM?.dataset?.key === key && this.#currentBGM.src && this.#currentBGM.src.includes(base)) {
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
      const order = ['ogg','m4a','mp3'];
      const bgm = new Audio();
      bgm.dataset.key = key;
      bgm.loop = loop;
      bgm.volume = this.#masterVolume * this.#bgmVolume;

      this.#currentBGM = bgm;
      this.#playWithExtFallback(bgm, base, order);
    }

    async #playWithExtFallback(audioEl, baseNoExt, order) {
      for (const ext of order) {
        const src = encodeURI(`${baseNoExt}.${ext}`);
        try {
          audioEl.src = src;
          await audioEl.play();
          return; // 再生開始に成功
        } catch (err) {
          if (err?.name === 'AbortError') return; // 他のBGM切替で中断された場合は終了
          // 次の拡張子へ
        }
      }
      console.warn('BGMの再生に失敗しました:', baseNoExt, order);
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
      const order = ['ogg','m4a','mp3'];
      const se = new Audio();
      se.volume = this.#masterVolume * this.#seVolume;
      this.#playWithExtFallback(se, base, order);
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
    
        resolveBgmBase(key) {
          const map = (AudioManager.FILES && AudioManager.FILES.bgm) || {};
          const mapped = map[key];
          if (mapped) {
            return mapped.replace(/\.(ogg|mp3|m4a)$/i, '');
          }
          // area系: xxx_areaN_(a|b) はそのまま
          if (/_area\d+_(a|b)$/i.test(key)) {
            return `/assets/audio/${key}`;
          }
          // area系: xxx_areaN は毎回 a/b ランダム
          if (/_area\d+$/i.test(key)) {
            const pick = Math.random() < 0.5 ? 'a' : 'b';
            return `/assets/audio/${key}_${pick}`;
          }
          // その他はキー名そのまま（例: title → /assets/audio/bgm_title）
          return `/assets/audio/${key}`;
        }

        resolveSeBase(key) {
          const map = (AudioManager.FILES && AudioManager.FILES.se) || {};
          const mapped = map[key];
          if (mapped) {
            return mapped.replace(/\.(ogg|mp3|m4a)$/i, '');
          }
          return `/assets/audio/${key}`;
        }  

             #resolveDynamicSrc(basePathNoExt) {
               try {
                 const a = document.createElement('audio');
                 const order = [
                   { ext: 'ogg', mime: 'audio/ogg; codecs="vorbis"' },
                   { ext: 'mp3', mime: 'audio/mpeg' },
                   { ext: 'm4a', mime: 'audio/mp4; codecs="mp4a.40.2"' }
                 ];
                 for (const cand of order) {
                   const support = a.canPlayType(cand.mime);
                   if (support === 'probably' || support === 'maybe') {
                     return `${basePathNoExt}.${cand.ext}`;
                   }
                 }
               } catch {}
               return `${basePathNoExt}.mp3`;
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
  