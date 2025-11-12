# Copyright 2025 DataRobot, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# You may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from unittest.mock import patch
import pytest
import datarobot
import pulumi


def test_agent_prediction_environment_forced_serverless(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(pulumi, "export", lambda *args: None)

    with patch("infra.llm.prediction_environment") as x:
        x.platform = datarobot.enums.PredictionEnvironmentPlatform.DATAROBOT
        from infra.agent_retrieval_agent import prediction_environment

        def assert_is_serverless(
            platform: str,
        ) -> None:
            assert (
                platform
                == datarobot.enums.PredictionEnvironmentPlatform.DATAROBOT_SERVERLESS
            )

        prediction_environment.platform.apply(assert_is_serverless)


def test_agent_prediction_environment_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pulumi, "export", lambda *args: None)

    with patch("infra.llm.prediction_environment", new=None):
        from infra.agent_retrieval_agent import prediction_environment

        def assert_is_serverless(
            platform: str,
        ) -> None:
            assert (
                platform
                == datarobot.enums.PredictionEnvironmentPlatform.DATAROBOT_SERVERLESS
            )

        prediction_environment.platform.apply(assert_is_serverless)
