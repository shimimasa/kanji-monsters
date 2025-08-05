import json
import random
import shutil
import os

# 元のJSONファイルのバックアップを作成
json_path = 'コード/public/data/enemies_proto.json'
backup_path = 'コード/public/data/enemies_proto_backup.json'

# バックアップを作成
shutil.copy2(json_path, backup_path)
print(f"バックアップを作成しました: {backup_path}")

# 弱点タイプのリスト
weakness_types = ["onyomi", "kunyomi", "meaning"]

# JSONファイルを読み込む
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# エリアごとのエネミーIDを収集
area_enemies = {}
for enemy in data:
    if enemy['id'].startswith('PRV-E') and 1 <= int(enemy['id'].split('-E')[1]) <= 400:
        stage_id = enemy.get('stageId', '')
        if stage_id not in area_enemies:
            area_enemies[stage_id] = []
        area_enemies[stage_id].append(enemy['id'])

# 更新されるエネミーの数をカウント
updated_count = 0

# エネミーデータを更新
for enemy in data:
    if enemy['id'].startswith('PRV-E') and 1 <= int(enemy['id'].split('-E')[1]) <= 400:
        enemy_num = int(enemy['id'].split('-E')[1])
        grade = enemy.get('grade', 7)
        stage_id = enemy.get('stageId', '')
        
        # 基本ステータスの計算式
        base_level = 20 + (grade - 7) * 2  # grade 7は基本レベル20
        level_variation = enemy_num % 5  # 0～4の変動値
        
        # エネミー番号に応じてステータスを調整
        enemy['level'] = base_level + level_variation
        
        # HPは基本値に加えて、エネミー番号による変動
        base_hp = 350 + (grade - 7) * 30
        hp_variation = (enemy_num % 10) * 5
        enemy['maxHp'] = base_hp + hp_variation
        
        # 攻撃力も同様に調整
        base_atk = 50 + (grade - 7) * 5
        atk_variation = (enemy_num % 8) * 2
        enemy['atk'] = base_atk + atk_variation
        
        # 経験値はレベルとHPに基づいて計算
        enemy['exp'] = int((enemy['level'] * 30) + (enemy['maxHp'] * 0.5))
        
        # 弱点をエリア内でバラバラに設定
        # エリア内での位置に基づいて弱点を決定
        if stage_id in area_enemies:
            position = area_enemies[stage_id].index(enemy['id'])
            weakness_index = position % len(weakness_types)
            enemy['weakness'] = weakness_types[weakness_index]
        else:
            # エリア情報がない場合はランダムに設定
            enemy['weakness'] = random.choice(weakness_types)
            
        updated_count += 1

# 更新したデータを書き込む
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"更新完了: {updated_count}体のエネミーデータを更新しました")