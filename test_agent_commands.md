# エージェントテストコマンド

## 1. 開発サーバーを起動

```bash
task agent:dev
```

このコマンドは、ポート8842でDRUMサーバーを起動します。
サーバーが起動するまで数秒待ってください。

## 2. エージェントをテストする方法

### 方法A: CLIコマンドでテスト（推奨・開発サーバー不要）

開発サーバーを起動せずに、エージェントを直接実行してテストできます。

```bash
# プレーンテキストでテスト（最もシンプル）
task agent:cli -- execute --user_prompt "集合場所：六本木駅
解散場所：渋谷駅
開始時間：15:00
解散時間：21:30
要件：
- 観光1箇所は90分以内
- 食事は120分
- 予算は1人10,000円まで"
```

または、JSON形式で：

```bash
task agent:cli -- execute --user_prompt '{"question": "集合場所：六本木駅\n解散場所：渋谷駅\n開始時間：15:00\n解散時間：21:30\n要件：\n- 観光1箇所は90分以内\n- 食事は120分\n- 予算は1人10,000円まで"}'
```

### 方法B: curlコマンドで開発サーバーにリクエスト

開発サーバー(`task agent:dev`)が起動している状態で、**別のターミナル**から：

```bash
curl -X POST http://localhost:8842/predict \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "集合場所：六本木駅\n解散場所：渋谷駅\n開始時間：15:00\n解散時間：21:30\n要件：\n- 観光1箇所は90分以内\n- 食事は120分\n- 予算は1人10,000円まで"
      }
    ],
    "model": "test-model"
  }'
```

または、JSON形式で（バックエンドと同じ形式）：

```bash
curl -X POST http://localhost:8842/predict \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "{\"question\": \"集合場所：六本木駅\\n解散場所：渋谷駅\\n開始時間：15:00\\n解散時間：21:30\\n要件：\\n- 観光1箇所は90分以内\\n- 食事は120分\\n- 予算は1人10,000円まで\"}"
      }
    ],
    "model": "test-model"
  }'
```

### 方法C: Pythonスクリプトでテスト

`test_agent.py`ファイルを作成：

```python
import json
import requests

url = "http://localhost:8842/predict"
payload = {
    "messages": [
        {
            "role": "user",
            "content": "集合場所：六本木駅\n解散場所：渋谷駅\n開始時間：15:00\n解散時間：21:30\n要件：\n- 観光1箇所は90分以内\n- 食事は120分\n- 予算は1人10,000円まで"
        }
    ],
    "model": "test-model"
}

response = requests.post(url, json=payload)
print("Status Code:", response.status_code)
print("Response:", json.dumps(response.json(), indent=2, ensure_ascii=False))
```

実行：
```bash
python test_agent.py
```

## 3. 期待される出力

エージェントは以下のようなJSON形式で応答するはずです：

```json
{
  "summary": {
    "total_duration_min": 390,
    "mobility_policy": "1km以上はタクシー",
    "atmosphere": "..."
  },
  "plan_a": {
    "title": "...",
    "timeline": [...],
    "total_minutes": 390,
    "estimated_cost_per_person_jpy": {"min": 8000, "max": 10000}
  },
  "plan_b": {
    "title": "...",
    "timeline": [...],
    "total_minutes": 390,
    "estimated_cost_per_person_jpy": {"min": 8000, "max": 10000}
  },
  "notes": [...],
  "constraints": {...},
  "candidates": {...}
}
```

## 4. トラブルシューティング

### サーバーが起動しない場合

- ポート8842が既に使用されている可能性があります
- 環境変数が正しく設定されているか確認してください
- `task agent:req` で依存関係をインストールしてください

### エージェントがエラーを返す場合

- エラーメッセージを確認してください
- エージェントのログを確認してください（`verbose=True`の場合）
- 入力形式が正しいか確認してください

### JSONが正しく返されない場合

- エージェントの最終タスクが正しく設定されているか確認してください
- LLMの応答を確認してください（verboseモードで）

