// Explicit MOTION-02 display hook allowlist. Reviewed independently of current source.
export const BATTLE_DISPLAY_HOOKS = [
    [
        [

        ],
        [
            "import { createBattleMotionBridge } from \u0027../visuals/battleMotionBridge.js\u0027;"
        ]
    ],
    [
        [

        ],
        [
            "    this._pixelMotion?.dispose();",
            "    this._pixelMotion = null;"
        ]
    ],
    [
        [

        ],
        [
            "      if (this === battleScreenState \u0026\u0026 gameState.currentStageId === \u0027hokkaido_area1\u0027 \u0026\u0026",
            "          [\u0027jikkuri\u0027, \u0027challenge\u0027].includes(gameState.gameMode)) {",
            "        this._pixelMotion = createBattleMotionBridge({ session: this._generation,",
            "          durations: { attack: ENEMY_ATTACK_ANIM_DURATION, damage: ENEMY_DAMAGE_ANIM_DURATION,",
            "            defeat: ENEMY_DEFEAT_ANIM_DURATION } });",
            "      }",
            ""
        ]
    ],
    [
        [

        ],
        [
            "    this._pixelMotion?.update({ stageId: gameState.currentStageId,",
            "      mode: this === battleScreenState \u0026\u0026 [\u0027jikkuri\u0027, \u0027challenge\u0027].includes(gameState.gameMode) ? \u0027normal\u0027 : \u0027excluded\u0027,",
            "      monsterId: gameState.currentEnemy?.id, enemyKey: gameState.currentEnemyIndex,",
            "      image: gameState.currentEnemy?.img, action: battleState.enemyAction,",
            "      remainingMs: battleState.enemyActionTimer, reducedMotion: prefersReducedMotion() }, dt);"
        ]
    ],
    [
        [
            "  this.ctx.drawImage(enemy.img, -ew/2, -eh/2, ew, eh);"
        ],
        [
            "  const motionDrawn = this._pixelMotion?.present(this.ctx, {",
            "    imageRect: { x: imageX - offsetX, y: imageY - offsetY, width: ew, height: eh },",
            "    clipRect: frameArea,",
            "  }, { x: imageX + ew/2, y: imageY + eh/2, rotation: rotateAngle });",
            "  if (!motionDrawn) this.ctx.drawImage(enemy.img, -ew/2, -eh/2, ew, eh);"
        ]
    ],
    [
        [

        ],
        [
            "    this._pixelMotion?.dispose();",
            "    this._pixelMotion = null;"
        ]
    ],
    [
        [

        ],
        [
            "    battleScreenState._pixelMotion?.actionStarted();"
        ]
    ],
    [
        [

        ],
        [
            "      battleScreenState._pixelMotion?.actionStarted();"
        ]
    ],
    [
        [

        ],
        [
            "  battleScreenState._pixelMotion?.actionStarted();"
        ]
    ]
];
