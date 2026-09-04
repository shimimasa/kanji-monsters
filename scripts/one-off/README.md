# one-off スクリプト（再実行不可・履歴参照用）

このフォルダのスクリプトは、データ整備時に一度だけ実行された変換スクリプトです。
対象データはすでに変換済みのため、**再実行するとデータを壊す可能性があります**。
参照用として保存しています（refactoring-plan.md Phase 1-4）。

現役のスクリプトは scripts/ 直下の2本のみ:
- canonicalize_stage_ids.mjs … stageId の正規化
- verify_stage_id_integrity.mjs … stageId の整合性検証
