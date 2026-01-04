# DataRobotデプロイエラーのログ取得と解決方法

## 1. Pulumiのログを確認

### 詳細ログレベルでデプロイ

```bash
# 環境変数を読み込み
set -a && source .env && set +a  # Linux/macOS
# または PowerShell: Get-Content .env | ForEach-Object { ... }

cd infra

# より詳細なログレベルでデプロイ（推奨）
PULUMI_DEBUG_COMMANDS=true uv run pulumi up --logtostderr -v=9 2>&1 | tee deploy.log

# または、標準的な詳細ログ
uv run pulumi up --logtostderr -v=3

# ログをファイルに保存（Windows PowerShell）
uv run pulumi up --logtostderr -v=9 *> deploy.log

# ログをファイルに保存（Linux/macOS）
uv run pulumi up --logtostderr -v=9 > deploy.log 2>&1
```

### スタックの状態を確認

```bash
cd infra
uv run pulumi stack --show-urns
uv run pulumi stack outputs
```

## 2. DataRobot API経由でログを取得

### デプロイメントのログを取得

```bash
# 環境変数を設定（.envファイルから）
source .env  # または set -a && source .env && set +a

# デプロイメントIDを取得（Pulumiの出力から）
DEPLOYMENT_ID="your-deployment-id-here"

# デプロイメントのログを取得
curl -X GET \
  "https://app.jp.datarobot.com/api/v2/deployments/$DEPLOYMENT_ID/logs/" \
  -H "Authorization: Bearer $DATAROBOT_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

### カスタムモデルのログを取得

```bash
# カスタムモデルIDを取得（Pulumiの出力から）
CUSTOM_MODEL_ID="your-custom-model-id-here"

# カスタムモデルのバージョンログを取得
curl -X GET \
  "https://app.jp.datarobot.com/api/v2/customModels/$CUSTOM_MODEL_ID/versions/" \
  -H "Authorization: Bearer $DATAROBOT_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.[0]'

# 特定のバージョンのログ
VERSION_ID="your-version-id"
curl -X GET \
  "https://app.jp.datarobot.com/api/v2/customModels/$CUSTOM_MODEL_ID/versions/$VERSION_ID/" \
  -H "Authorization: Bearer $DATAROBOT_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

### 実行環境のログを取得

```bash
# 実行環境IDを取得（Pulumiの出力から）
EXECUTION_ENVIRONMENT_ID="your-execution-environment-id"

# 実行環境の詳細を取得
curl -X GET \
  "https://app.jp.datarobot.com/api/v2/executionEnvironments/$EXECUTION_ENVIRONMENT_ID/" \
  -H "Authorization: Bearer $DATAROBOT_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

## 3. Pythonスクリプトでログを取得

プロジェクトルートに`get_deployment_logs.py`スクリプトを作成しました。実行方法：

```bash
# 環境変数を設定
set -a && source .env && set +a  # Linux/macOS

# スクリプトを実行
python get_deployment_logs.py

# または特定のデプロイメントIDを指定
DEPLOYMENT_ID=your-deployment-id python get_deployment_logs.py

# infraディレクトリから実行する場合
cd infra
uv run python ../get_deployment_logs.py
```

このスクリプトは：
- デプロイメントIDが指定されている場合、そのデプロイメントの詳細を表示
- 指定されていない場合、エージェント関連のカスタムモデルを検索して表示

## 4. Pulumiのリソース状態を確認

```bash
cd infra

# リソースの詳細を表示
uv run pulumi stack --show-urns

# 特定のリソースの状態を確認
uv run pulumi stack output

# リソースの詳細ログ
uv run pulumi up --dry-run --diff

# 過去の操作ログ
uv run pulumi stack history
```

## 5. エージェントのデプロイメントエラーを調査

### エージェントデプロイメントIDを取得

```bash
cd infra
uv run pulumi stack output | grep -i agent
```

### エージェントのヘルスチェック

```python
import os
import datarobot as dr

dr.Client(
    token=os.getenv("DATAROBOT_API_TOKEN"),
    endpoint=os.getenv("DATAROBOT_ENDPOINT", "https://app.jp.datarobot.com/api/v2")
)

deployment_id = "your-agent-deployment-id"

try:
    deployment = dr.Deployment.get(deployment_id)
    
    print(f"Deployment: {deployment.label}")
    print(f"ID: {deployment.id}")
    
    # ヘルス設定（メソッドが存在する場合）
    try:
        health_settings = deployment.get_health_settings()
        print(f"Health Settings: {health_settings}")
    except AttributeError:
        print("Health settings method not available")
    except Exception as e:
        print(f"Error getting health settings: {e}")
    
    # 設定
    try:
        settings = deployment.get_settings()
        print(f"Settings: {settings}")
    except Exception as e:
        print(f"Error getting settings: {e}")
    
except Exception as e:
    print(f"Error: {e}")
```

## 6. よくあるエラーと解決方法

### エラー: "Custom model did not start correctly"

このエラーが発生する場合：

1. **カスタムモデルのビルドログを確認**
   ```bash
   # DataRobot UIで確認
   # Applications > Custom Models > [Your Model] > Versions > [Latest Version] > Build Logs
   ```

2. **実行環境を確認**
   ```bash
   # 実行環境が正しく設定されているか確認
   curl -X GET \
     "https://app.jp.datarobot.com/api/v2/executionEnvironments/$EXECUTION_ENVIRONMENT_ID/" \
     -H "Authorization: Bearer $DATAROBOT_API_TOKEN"
   ```

3. **エージェントコードの構文エラーを確認**
   ```bash
   cd agent_retrieval_agent
   python -m py_compile custom_model/agent.py
   python -m py_compile custom_model/custom.py
   ```

4. **依存関係を確認**
   ```bash
   cd agent_retrieval_agent
   uv run python -c "import datarobot_genai; print('OK')"
   ```

### エラー: "Deployment creation failed"

1. **デプロイメントの詳細を確認**
   ```bash
   # Pulumiの詳細ログ
   cd infra
   uv run pulumi up --logtostderr -v=9
   ```

2. **DataRobotのAPI制限を確認**
   - 同時デプロイメント数の制限
   - リソース制限

3. **予測環境の状態を確認**
   ```python
   import datarobot as dr
   import os
   
   dr.Client(token=os.getenv("DATAROBOT_API_TOKEN"))
   
   # 予測環境をリスト
   prediction_environments = dr.PredictionEnvironment.list()
   for pe in prediction_environments:
       print(f"{pe.id}: {pe.name}")
   ```

## 7. ログをファイルに保存して分析

```bash
# 完全なデプロイログを保存
cd infra
uv run pulumi up --logtostderr -v=9 > deploy_full.log 2>&1

# エラー部分だけを抽出
grep -i "error\|failed\|exception" deploy_full.log > deploy_errors.log

# エージェント関連のエラーを抽出
grep -i "agent\|custom.*model" deploy_full.log > agent_errors.log
```

## 8. DataRobot UIで確認

1. **Applications > Custom Applications**
   - アプリケーションの状態を確認
   - ログを表示

2. **Deployments**
   - デプロイメントのヘルスステータス
   - 予測エラーログ

3. **Custom Models**
   - カスタムモデルのビルドログ
   - バージョンごとのステータス

4. **Execution Environments**
   - 実行環境の状態
   - ビルドログ

## 9. デバッグ用のPulumiコマンド

```bash
cd infra

# プレビューモード（実際にデプロイしない）
uv run pulumi preview --logtostderr -v=9

# 詳細な差分を表示
uv run pulumi up --diff --logtostderr -v=9

# 特定のリソースのみ更新
uv run pulumi up --target "urn:pulumi:..." --logtostderr -v=9

# スタックの情報を表示
uv run pulumi stack --show-ids
uv run pulumi stack outputs

# スタックの出力からデプロイメントIDを取得
uv run pulumi stack output | grep -i "deployment"
uv run pulumi stack output --json | jq '.[] | select(.key | contains("Deployment ID"))'
```

## 10. クイックスタート: エラーログを取得する手順

### ステップ1: Pulumiの詳細ログを取得

```bash
# 環境変数を読み込み
set -a && source .env && set +a
cd infra

# 詳細ログでデプロイ（ログをファイルに保存）
uv run pulumi up --logtostderr -v=9 2>&1 | tee deploy_full.log

# エラーのみを抽出
grep -i "error\|failed\|exception" deploy_full.log > deploy_errors.log
```

### ステップ2: Pulumiの出力からデプロイメントIDを取得

```bash
cd infra
uv run pulumi stack output
# またはJSON形式で
uv run pulumi stack output --json > stack_outputs.json
```

### ステップ3: DataRobot APIでログを確認

```bash
# デプロイメントIDを環境変数に設定（Pulumiの出力から）
export DEPLOYMENT_ID="your-deployment-id"

# Pythonスクリプトでログを取得
python get_deployment_logs.py

# またはcurlで直接取得
curl -X GET \
  "$DATAROBOT_ENDPOINT/deployments/$DEPLOYMENT_ID/" \
  -H "Authorization: Bearer $DATAROBOT_API_TOKEN" \
  | jq '.'
```

### ステップ4: DataRobot UIで確認

1. **Applications > Custom Applications** - アプリケーションの状態とログ
2. **Deployments** - デプロイメントのヘルスステータスとエラーログ
3. **Custom Models** - カスタムモデルのビルドログ
4. **Execution Environments** - 実行環境の状態

## 11. よくあるエラー: "Custom model did not start correctly" の調査

このエラーが発生した場合の調査手順：

```bash
# 1. Pulumiの出力からカスタムモデルIDを取得
cd infra
CUSTOM_MODEL_ID=$(uv run pulumi stack output --json | jq -r '.[] | select(.key | contains("Custom Model ID")) | .value')

# 2. カスタムモデルの詳細を取得
curl -X GET \
  "$DATAROBOT_ENDPOINT/customModels/$CUSTOM_MODEL_ID/" \
  -H "Authorization: Bearer $DATAROBOT_API_TOKEN" \
  | jq '.'

# 3. 最新バージョンのビルドログを取得（DataRobot UI推奨）
# Applications > Custom Models > [Your Model] > Versions > [Latest] > Build Logs

# 4. エージェントコードの構文エラーを確認
cd ../agent_retrieval_agent
python -m py_compile custom_model/agent.py
python -m py_compile custom_model/custom.py
```

