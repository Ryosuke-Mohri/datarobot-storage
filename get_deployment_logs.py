#!/usr/bin/env python3
"""
DataRobotデプロイメントのログを取得するスクリプト

使用方法:
    python get_deployment_logs.py
    # または特定のデプロイメントIDを指定
    DEPLOYMENT_ID=your-deployment-id python get_deployment_logs.py
    # または特定のカスタムモデルIDを指定
    CUSTOM_MODEL_ID=your-custom-model-id python get_deployment_logs.py
"""

import os
import sys
import datarobot as dr
import json
from datetime import datetime
from typing import Optional

def get_custom_model_details(custom_model_id: str):
    """カスタムモデルの詳細情報を取得"""
    api_token = os.getenv("DATAROBOT_API_TOKEN")
    endpoint = os.getenv("DATAROBOT_ENDPOINT", "https://app.jp.datarobot.com/api/v2")
    
    if not api_token:
        print("エラー: DATAROBOT_API_TOKEN環境変数が設定されていません")
        sys.exit(1)
    
    dr.Client(token=api_token, endpoint=endpoint)
    
    try:
        # CustomModel.get()が使えない場合があるので、list()で検索
        print(f"カスタムモデルID {custom_model_id} を検索中...")
        custom_models = dr.CustomModel.list()
        custom_model = None
        for cm in custom_models:
            if cm.id == custom_model_id:
                custom_model = cm
                break
        
        if not custom_model:
            print(f"エラー: カスタムモデルID {custom_model_id} が見つかりません")
            print(f"利用可能なカスタムモデル数: {len(custom_models)}")
            return
        
        print(f"カスタムモデル: {custom_model.name}")
        print(f"ID: {custom_model.id}")
        if hasattr(custom_model, 'created'):
            print(f"作成日時: {custom_model.created}")
        
        # バージョンを取得
        print(f"\n=== バージョン情報 ===")
        try:
            versions = custom_model.get_versions()
            if versions:
                latest_version = versions[0]
                print(f"最新バージョンID: {latest_version.id}")
                print(f"バージョンラベル: {getattr(latest_version, 'label', 'N/A')}")
                if hasattr(latest_version, 'created'):
                    print(f"作成日時: {latest_version.created}")
                if hasattr(latest_version, 'version_status'):
                    print(f"バージョンステータス: {latest_version.version_status}")
                
                # エラーメッセージ
                if hasattr(latest_version, 'validation_error') and latest_version.validation_error:
                    print(f"\n=== 検証エラー ===")
                    print(latest_version.validation_error)
                
                # ビルドログを取得（REST APIを使用）
                print(f"\n=== ビルドログを取得中（REST API経由） ===")
                import requests
                version_id = latest_version.id
                build_logs_url = f"{endpoint}/customModels/{custom_model_id}/versions/{version_id}/buildLogs/"
                headers = {"Authorization": f"Bearer {api_token}"}
                try:
                    response = requests.get(build_logs_url, headers=headers)
                    if response.ok:
                        build_logs_data = response.json()
                        if build_logs_data.get('logs'):
                            print(build_logs_data['logs'])
                        else:
                            print("ビルドログがまだ生成されていません")
                    else:
                        print(f"ビルドログ取得エラー (HTTP {response.status_code}): {response.text}")
                except Exception as e:
                    print(f"ビルドログ取得エラー: {e}")
                
                # バージョンの詳細属性を表示
                print(f"\n=== バージョンの詳細属性 ===")
                important_attrs = ['id', 'label', 'version_status', 'created', 'validation_error']
                for attr in important_attrs:
                    if hasattr(latest_version, attr):
                        try:
                            value = getattr(latest_version, attr)
                            if not callable(value) and value is not None:
                                print(f"{attr}: {value}")
                        except:
                            pass
                
        except Exception as e:
            print(f"バージョン取得エラー: {e}")
            import traceback
            traceback.print_exc()
            
    except Exception as e:
        print(f"カスタムモデル取得エラー: {e}")
        import traceback
        traceback.print_exc()

def get_deployment_logs(deployment_id: Optional[str] = None, custom_model_id: Optional[str] = None):
    """デプロイメントのログを取得"""
    api_token = os.getenv("DATAROBOT_API_TOKEN")
    endpoint = os.getenv("DATAROBOT_ENDPOINT", "https://app.jp.datarobot.com/api/v2")
    
    if not api_token:
        print("エラー: DATAROBOT_API_TOKEN環境変数が設定されていません")
        sys.exit(1)
    
    dr.Client(token=api_token, endpoint=endpoint)
    
    if custom_model_id:
        get_custom_model_details(custom_model_id)
        return
    
    if deployment_id:
        try:
            deployment = dr.Deployment.get(deployment_id)
            print(f"デプロイメント: {deployment.label}")
            print(f"ID: {deployment.id}")
            
            # 基本情報を表示
            if hasattr(deployment, 'description') and deployment.description:
                print(f"説明: {deployment.description}")
            if hasattr(deployment, 'status'):
                print(f"ステータス: {deployment.status}")
            if hasattr(deployment, 'importance'):
                print(f"重要度: {deployment.importance}")
            
            # ヘルス情報を表示
            print(f"\n=== ヘルス情報 ===")
            
            # サービスヘルス
            if hasattr(deployment, 'service_health'):
                print(f"サービスヘルス:")
                print(json.dumps(deployment.service_health, indent=2, ensure_ascii=False, default=str))
            
            # モデルヘルス
            if hasattr(deployment, 'model_health'):
                print(f"\nモデルヘルス:")
                print(json.dumps(deployment.model_health, indent=2, ensure_ascii=False, default=str))
            
            # 精度ヘルス
            if hasattr(deployment, 'accuracy_health'):
                print(f"\n精度ヘルス:")
                print(json.dumps(deployment.accuracy_health, indent=2, ensure_ascii=False, default=str))
            
            # 公平性ヘルス
            if hasattr(deployment, 'fairness_health'):
                print(f"\n公平性ヘルス:")
                print(json.dumps(deployment.fairness_health, indent=2, ensure_ascii=False, default=str))
            
            # ヘルス設定を取得（メソッドが存在する場合）
            try:
                health_settings = deployment.get_health_settings()
                print(f"\n=== ヘルス設定 ===")
                print(json.dumps(health_settings, indent=2, ensure_ascii=False, default=str))
            except AttributeError:
                pass  # メソッドが存在しない場合はスキップ
            except Exception as e:
                print(f"\nヘルス設定取得エラー: {e}")
            
            # モデル情報
            if hasattr(deployment, 'model'):
                print(f"\n=== モデル情報 ===")
                print(json.dumps(deployment.model, indent=2, ensure_ascii=False, default=str))
            
            # 予測環境情報
            if hasattr(deployment, 'prediction_environment'):
                print(f"\n=== 予測環境 ===")
                print(json.dumps(deployment.prediction_environment, indent=2, ensure_ascii=False, default=str))
            
            # 予測使用状況
            if hasattr(deployment, 'prediction_usage'):
                print(f"\n=== 予測使用状況 ===")
                print(json.dumps(deployment.prediction_usage, indent=2, ensure_ascii=False, default=str))
            
            # ガバナンス情報
            if hasattr(deployment, 'governance'):
                print(f"\n=== ガバナンス ===")
                print(json.dumps(deployment.governance, indent=2, ensure_ascii=False, default=str))
            
        except Exception as e:
            print(f"デプロイメント取得エラー: {e}")
            import traceback
            traceback.print_exc()
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
    custom_model_id = os.getenv("CUSTOM_MODEL_ID")
    get_deployment_logs(deployment_id, custom_model_id)

