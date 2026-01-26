漢字ヨミタビ 設計憲法（Single Source of Truth）

本ドキュメントは、漢字ヨミタビ（kanji-monsters）における
**設計上の最終的な正史（Single Source of Truth）**を定義する。
実装・改修・拡張は、必ず本憲法に準拠する。

A. 画面遷移（Screen Navigation）
正史

画面遷移の唯一の入口は setupFSM.switchScreen とする

changeScreen イベントは 必ず setupFSM に集約される

ルール

screenManager は 画面のライフサイクル管理のみを担う

window.switchScreen は 開発/デバッグ用途限定

production ビルドでは露出しない

FSM は 1実装のみを正史とする

core/fsm.js を正

core/stateMachine.js は移行完了後に廃止候補

禁止事項

任意の画面から直接別画面を呼ぶこと

EventBus を「遷移の正史」として扱うこと

B. 状態管理（Game State）
正史

すべての可変ゲーム状態は gameState に集約する

各レイヤの責務

gameState

プレイヤー進捗

現在のステージ/モード

学習状態（復習キュー、達成度）

画面（Screen）

表示用の一時状態のみ

永続化対象を保持してはならない

禁止事項

Screen が独自に永続化すること

gameState を経由しない状態更新

C. 永続化（Persistence）
正史

ローカル保存 krb_save が唯一の正史

Firebase は「同期キャッシュ」として扱う

方針

読み込み順序

krb_save

（存在しない場合のみ）Firebase

書き込み順序

krb_save

非同期で Firebase へ反映

スキーマ

旧スキーマ（kanjiGameSave など）は 読み取り専用

起動時に 1回だけマイグレーションし、以後は使用しない

禁止事項

Firebase を直接参照するゲームロジック

複数スキーマへの同時書き込み

D. 同期（Firebase）
役割

端末間引き継ぎ

障害時の復旧

学習ログの将来的分析

同期対象（最小）

playerProfile

progress（集約済み）

review 状態（要約）

禁止事項

Firebase を前提にした画面設計

Firestore スキーマをゲーム進行の分岐条件に使うこと

E. データ規約（ID / 命名）
正史

正史IDはデータファイルに定義された stageId

コード側は 1箇所のみで正規化を行う

規約

stageId: 小文字・snake_case

areaId: stageId から派生

grade:

学習難易度を表す数値のみ

学年/UI用途と混用しない

禁止事項

画面ごとの独自解釈

フォールバック規則の分散実装

F. モード定義（Battle / Practice / Review）
正史

battle は「戦闘」

practice / review は「学習セッション」

設計方針

UI コンポーネントの共有は可

状態モデル・勝敗定義は共有しない

禁止事項

battle を学習基盤として再解釈すること

継承による意味論の拡張

G. リポジトリ構成（Repository）
正史

ルートディレクトリ = プロダクト本体（Vite）

image-pipeline/ = 開発用ツール

my-app/ = 試作・アーカイブ

運用方針

ビルド成果物（dist/）は編集しない

public/ はプロダクト専用

H. 実装優先順位（拘束力あり）
P0（最優先）

画面遷移の正史統一

永続化の正史統一

P1

ID規約の統一

モード定義の明確化

P2

リポジトリ整理

I. 最終原則

動くコードより、迷わない設計を優先する

本憲法に反する実装は「バグ」とみなす

例外は一時的に許可されるが、必ずドキュメント化する