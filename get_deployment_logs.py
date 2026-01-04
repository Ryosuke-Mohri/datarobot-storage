#!/usr/bin/env python3
"""
DataRobotデプロイメントのログを取得するスクリプト

使用方法:
    python get_deployment_logs.py
    # または特定のデプロイメントIDを指定
    DEPLOYMENT_ID=your-deployment-id python get_deployment_logs.py
"""

import os
import sys
import datarobot as dr
import json
from datetime import datetime
from typing import Optional

def get_deployment_logs(deployment_id: Optional[str] = None):
    """デプロイメントのログを取得"""
    api_token = os.getenv("DATAROBOT_API_TOKEN")
    endpoint = os.getenv("DATAROBOT_ENDPOINT", "https://app.jp.datarobot.com/api/v2")
    
    if not api_token:
        print("エラー: DATAROBOT_API_TOKEN環境変数が設定されていません")
        sys.exit(1)
    
    dr.Client(token=api_token, endpoint=endpoint)
    
    if deployment_id:
        try:
            deployment = dr.Deployment.get(deployment_id)
            print(f"デプロイメント: {deployment.label}")
            print(f"ID: {deployment.id}")
            print(f"ヘルスステータス: {deployment.health}")
            print(f"サービスヘルス: {deployment.service_health}")
            
            settings = deployment.get_settings()
            print(f"\n設定:")
            print(json.dumps(settings, indent=2, ensure_ascii=False))
            
        except Exception as e:
            print(f"デプロイメント取得エラー: {e}")
    else:
        print("デプロイメントIDが指定されていません。カスタムモデルを検索します...")
        get_custom_model_logs()

def get_custom_model_logs():
    """カスタムモデルのログを取得"""
    try:
        custom_models = dr.CustomModel.list()
        agent_models = [m for m in custom_models if "agent" in m.name.lower() or "talk" in m.name.lower()]
        
        print(f"\n見つかったエージェント関連カスタムモデル: {len(agent_models)}件\n")
        
        for model in agent_models[:10]:  # 最新10件
            print(f"=" * 80)
            print(f"モデル名: {model.name}")
            print(f"モデルID: {model.id}")
            print(f"作成日時: {model.created}")
            
            try:
                versions = model.get_versions()
                if versions:
                    latest_version = versions[0]
                    print(f"最新バージョンID: {latest_version.id}")
                    print(f"バージョンステータス: {latest_version.version_status}")
                    print(f"作成日時: {latest_version.created}")
                    
                    # エラーメッセージがある場合
                    if hasattr(latest_version, 'validation_error') and latest_version.validation_error:
                        print(f"\n検証エラー:")
                        print(latest_version.validation_error)
                    
            except Exception as e:
                print(f"バージョン取得エラー: {e}")
            
            print()
            
    except Exception as e:
        print(f"カスタムモデル一覧取得エラー: {e}")

if __name__ == "__main__":
    deployment_id = os.getenv("DEPLOYMENT_ID")
    get_deployment_logs(deployment_id)

