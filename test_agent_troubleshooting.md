# エージェントテスト時のトラブルシューティング

## エラー: `ModuleNotFoundError: No module named 'datarobot_genai'`

このエラーが発生した場合、依存関係がインストールされていない可能性があります。

### 解決方法

1. **依存関係をインストール**

```bash
# エージェントディレクトリに移動
cd agent_retrieval_agent

# 依存関係をインストール
task agent:req
# または
task agent:install
```

2. **uvを使用して直接インストール**

```bash
cd agent_retrieval_agent
uv sync --all-extras
```

3. **仮想環境の問題を回避**

エラーログに以下が表示されている場合：
```
warning: `VIRTUAL_ENV=/home/notebooks/storage/.venv` does not match the project environment path `.venv` and will be ignored
```

以下のいずれかを試してください：

```bash
# 方法1: --activeフラグを使用
uv sync --all-extras --active

# 方法2: 既存の仮想環境を無効化
unset VIRTUAL_ENV
task agent:req

# 方法3: プロジェクトの仮想環境を使用
cd agent_retrieval_agent
source .venv/bin/activate  # または .venv\Scripts\activate (Windows)
uv sync --all-extras
```

4. **依存関係が正しくインストールされたか確認**

```bash
cd agent_retrieval_agent
uv run python -c "import datarobot_genai; print('OK')"
```

これでエラーが発生しない場合は、依存関係はインストールされています。

### 完全なセットアップ手順

```bash
# 1. エージェントディレクトリに移動
cd agent_retrieval_agent

# 2. 仮想環境の問題をクリア（必要に応じて）
unset VIRTUAL_ENV

# 3. 依存関係をインストール
task agent:req
# または
uv sync --all-extras

# 4. 依存関係の確認
uv run python -c "import datarobot_genai; import crewai; print('Dependencies OK')"

# 5. エージェントをテスト
task agent:cli -- execute --user_prompt "集合場所：六本木駅
解散場所：渋谷駅
開始時間：15:00
解散時間：21:30
要件：
- 観光1箇所は90分以内
- 食事は120分
- 予算は1人10,000円まで"
```

