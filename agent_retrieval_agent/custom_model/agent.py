# Copyright 2025 DataRobot, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Union

from config import Config
from crewai import LLM, Agent, Task
from datarobot_genai.crewai.agent import build_llm
from datarobot_genai.crewai.base import CrewAIAgent
from datarobot_genai.crewai.events import CrewAIEventListener


def _parse_jp_date_prompt(user_text: str) -> Dict[str, Any]:
    """
    半構造化の日本語プロンプトをbest-effortでパースする。

    例:
      集合場所：六本木駅
      解散場所：渋谷駅
      開始時間：15:00
      解散時間：21:30
      要件：
      - 観光1箇所は90分以内
      - 食事は120分
      - 予算は1人10,000円まで
      - 静かめの店がいい
      - お酒が美味しくて景色がきれいな場所がいい
      - 1km以上の距離はタクシー移動をすること

    注意:
      - ここでは「抽出できるものだけ抽出」する。
      - 最終的な正規化は Requirement Extractor（LLM）で行う。
    """
    text = (user_text or "").strip()

    def pick(pattern: str) -> Optional[str]:
        m = re.search(pattern, text, flags=re.MULTILINE)
        return m.group(1).strip() if m else None

    meeting = pick(r"^集合場所：\s*(.+)$")
    dropoff = pick(r"^解散場所：\s*(.+)$")

    def normalize_time(t: Optional[str]) -> Optional[str]:
        if not t:
            return None
        t = t.strip().replace("：", ":")

        # HH:MM
        m = re.match(r"^([0-2]?\d):([0-5]\d)$", t)
        if m:
            return f"{int(m.group(1)):02d}:{int(m.group(2)):02d}"

        # "15時" / "15時00分"
        m = re.match(r"^([0-2]?\d)\s*時(?:\s*([0-5]?\d)\s*分)?$", t)
        if m:
            hh = int(m.group(1))
            mm = int(m.group(2)) if m.group(2) is not None else 0
            return f"{hh:02d}:{mm:02d}"

        return None

    start_time = normalize_time(pick(r"^開始時間：\s*(.+)$"))
    end_time = normalize_time(pick(r"^解散時間：\s*(.+)$"))

    # "要件：" 以降の箇条書きを取得（- / ・）
    req_block = ""
    m = re.search(r"^要件：\s*\n([\s\S]+)$", text, flags=re.MULTILINE)
    if m:
        req_block = m.group(1)

    req_lines: List[str] = []
    for line in req_block.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("-"):
            req_lines.append(line.lstrip("-").strip())
        elif line.startswith("・"):
            req_lines.append(line.lstrip("・").strip())

    sightseeing_max_min: Optional[int] = None
    meal_minutes: Optional[int] = None
    budget_max_jpy: Optional[int] = None
    taxi_threshold_km: Optional[float] = None

    def parse_jpy_amount(s: str) -> Optional[int]:
        s = s.strip()
        # 10,000円 / 10000円
        m1 = re.search(r"([0-9,]+)\s*円", s)
        if m1:
            return int(m1.group(1).replace(",", ""))

        # 1万円 / 2.5万円
        m2 = re.search(r"(\d+(?:\.\d+)?)\s*万\s*円?", s)
        if m2:
            return int(float(m2.group(1)) * 10000)

        return None

    for r in req_lines:
        mm = re.search(r"観光.*?(\d+)\s*分", r)
        if mm and any(k in r for k in ["以内", "まで", "以下"]):
            sightseeing_max_min = int(mm.group(1))

        mm = re.search(r"食事.*?(\d+)\s*分", r)
        if mm:
            meal_minutes = int(mm.group(1))

        if "予算" in r:
            amt = parse_jpy_amount(r)
            if amt is not None and any(k in r for k in ["まで", "以内", "以下"]):
                budget_max_jpy = amt

        mm = re.search(r"(\d+(?:\.\d+)?)\s*km以上.*タクシー", r)
        if mm:
            taxi_threshold_km = float(mm.group(1))

    parse_confidence = (
        "high"
        if (meeting or dropoff or start_time or end_time or req_lines)
        else "low"
    )

    return {
        "meeting_place": meeting,
        "dropoff_place": dropoff,
        "time_window": {"start": start_time, "end": end_time},
        "requirements_raw": req_lines,
        "extracted": {
            "sightseeing_max_min": sightseeing_max_min,
            "meal_minutes": meal_minutes,
            "budget_max_jpy": budget_max_jpy,
            "taxi_threshold_km": taxi_threshold_km,
        },
        "parse_confidence": parse_confidence,
    }


class MyAgent(CrewAIAgent):
    """
    デートプラン（行程）提案エージェント。

    Flow:
      1) Requirement Extractor: ユーザー要望を構造化制約に正規化
      2) Spot Researcher: レストラン/観光地を探索（URL付き）
      3) Itinerary Optimizer: 時間割と移動方針を守って行程作成（Plan A/B）
      4) Quality Checker: 最終出力（日本語Markdown + 統合JSON）を作成

    強制ルール:
      - 最終回答は必ず日本語
      - スポットは可能な限りURLを付与（取れない場合は要確認として明示）
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: Optional[str] = None,
        verbose: Optional[Union[bool, str]] = True,
        timeout: Optional[int] = 90,
        **kwargs: Any,
    ):
        super().__init__(
            api_key=api_key,
            api_base=api_base,
            model=model,
            verbose=verbose,
            timeout=timeout,
            **kwargs,
        )
        self.config = Config()
        self.default_model = self.config.llm_default_model
        self.event_listener = CrewAIEventListener()

    def llm(
        self,
        preferred_model: str | None = None,
        auto_model_override: bool = True,
    ) -> LLM:
        model = preferred_model or self.default_model
        if auto_model_override and not self.config.use_datarobot_llm_gateway:
            model = self.default_model
        if self.verbose:
            print(f"Using model: {model}")
        return build_llm(
            api_base=self.api_base,
            api_key=self.api_key,
            model=model,
            deployment_id=self.config.llm_deployment_id,
            timeout=self.timeout,
        )

    def make_kickoff_inputs(self, user_prompt_content: str) -> dict[str, Any]:
        parsed = _parse_jp_date_prompt(str(user_prompt_content))
        return {
            "user_request": str(user_prompt_content),
            "parsed_request_json": parsed,
        }

    @property
    def agents(self) -> List[Agent]:
        return [
            self.agent_requirement_extractor,
            self.agent_spot_researcher,
            self.agent_itinerary_optimizer,
            self.agent_quality_checker,
        ]

    @property
    def tasks(self) -> List[Task]:
        return [
            self.task_extract_requirements,
            self.task_search_spots,
            self.task_build_itinerary,
            self.task_finalize_output,
        ]

    # -----------------------
    # Agents
    # -----------------------
    @property
    def agent_requirement_extractor(self) -> Agent:
        return Agent(
            role="Requirement Extractor",
            goal="【日本語で】ユーザー要望を、検索と行程作成に使える構造化制約（条件）に正規化する。",
            backstory=(
                "あなたは曖昧な要望を、計画条件へ変換する専門家。回答は必ず日本語。"
                "ユーザーへ追加質問はしない。足りない情報は妥当なデフォルトを置き、assumptions に明記する。"
                "入力に parsed_request_json があり parse_confidence が high の場合、それを最優先で採用する。"
            ),
            allow_delegation=False,
            verbose=self.verbose,
            llm=self.llm(preferred_model="datarobot/azure/gpt-4o-mini"),
            tools=self.mcp_tools,
        )

    @property
    def agent_spot_researcher(self) -> Agent:
        return Agent(
            role="Spot Researcher",
            goal="【日本語で】条件に合うレストラン・観光地候補を複数探索し、可能な限りURL付きで返す。",
            backstory=(
                "あなたはローカルスポット探索の専門家。回答は必ず日本語。"
                "利用可能なら tools（places/web search 等）で実在確認し、URLを付与する。"
                "URLは優先順：公式サイト > Google Maps > 食べログ/Retty/一休/Tripadvisor等。"
                "URLが取得できない場合は url=null とし、verification=needs_verification とする。"
            ),
            allow_delegation=False,
            verbose=self.verbose,
            llm=self.llm(preferred_model="datarobot/azure/gpt-4o-mini"),
            tools=self.mcp_tools,
        )

    @property
    def agent_itinerary_optimizer(self) -> Agent:
        return Agent(
            role="Itinerary Optimizer",
            goal="【日本語で】時間枠・滞在時間・移動方針を守り、実現可能なデート行程（Plan A/B）を作る。",
            backstory=(
                "あなたは行程最適化のプロ。回答は必ず日本語。"
                "開店時間等の不確実性があれば check_opening_hours=true として明示する。"
                "Plan A/Plan B の2案を出し、雨天・混雑・予約不可などのリスクに備える。"
            ),
            allow_delegation=False,
            verbose=self.verbose,
            llm=self.llm(preferred_model="datarobot/azure/gpt-4o-mini"),
            tools=self.mcp_tools,
        )

    @property
    def agent_quality_checker(self) -> Agent:
        return Agent(
            role="Quality Checker",
            goal="【日本語で】最終出力（Markdown）を品質担保し、URL併記・時間整合・要確認事項を明確化する。",
            backstory=(
                "あなたは校閲・品質保証の専門家。回答は必ず日本語。"
                "時間計算（開始/終了、合計分）の矛盾を修正し、verified と needs_verification を本文で区別する。"
                "Markdown本文は日本語のみ。最後に統合JSONを添付する。"
            ),
            allow_delegation=False,
            verbose=self.verbose,
            llm=self.llm(),
            tools=self.mcp_tools,
        )

    # -----------------------
    # Tasks
    # -----------------------
    @property
    def task_extract_requirements(self) -> Task:
        return Task(
            description="""
あなたは以下を受け取る：
- user_request（生テキスト）
- parsed_request_json（可能なら事前パース結果）

【最優先ルール】
parsed_request_json の parse_confidence が high の場合、
そこに含まれる meeting_place / dropoff_place / time_window / extracted を優先して採用する。

【重要】回答は必ず日本語（JSON内の値も日本語）。

出力は JSON のみ。スキーマ：
{
  "meeting_place": "string|null",
  "dropoff_place": "string|null",
  "area": "string (主な行動エリア。集合/解散から推定)",
  "date": "string (YYYY-MM-DD。なければ null)",
  "time_window": {"start": "HH:MM|null", "end": "HH:MM|null"},
  "stay_durations_min": {
     "meal": number|null,
     "sightseeing_max": number|null,
     "cafe": number|null,
     "buffer": number|null
  },
  "budget_per_person_jpy": {"min": number|null, "max": number|null},
  "preferences": {
     "quiet_place": true|false|null,
     "good_alcohol": true|false|null,
     "nice_view": true|false|null
  },
  "mobility_policy": {
     "taxi_over_km": number|null,
     "walk_under_km": number|null
  },
  "must_have": ["string"],
  "avoid": ["string"],
  "assumptions": ["string"],
  "open_questions": []
}

ルール：
- ユーザーに質問しない。
- 不足は null にしつつ、妥当なデフォルトを assumptions に明記。
- requirements_raw を must_have / preferences / mobility_policy に落とす。
""".strip(),
            expected_output="正規化された制約条件(JSON)。",
            agent=self.agent_requirement_extractor,
        )

    @property
    def task_search_spots(self) -> Task:
        return Task(
            description="""
【重要】回答は必ず日本語（JSON内の値も日本語）。

抽出済みの constraints JSON を使い、エリア周辺のレストラン・観光地を検索する。

可能ならツール（places/web search）で実在確認し、必ずURLを付与する。
- URLは優先順：公式サイト > Google Maps > 食べログ/Retty/一休/トリップアドバイザー等
- URLが取得できない場合は url を null にし、verification を needs_verification にする。

出力は JSON のみ。スキーマ：
{
  "restaurants": [
    {
      "name": "string",
      "category": "string",
      "area_detail": "string",
      "price_range": "string (例：¥¥ / 予算感)",
      "opening_hours_note": "string|null",
      "why_recommended": "string",
      "url": "string|null",
      "source": "official|google_maps|tabelog|retty|ikyu|other|unknown",
      "verification": "verified|needs_verification"
    }
  ],
  "attractions": [
    {
      "name": "string",
      "type": "string (例：美術館/展望/公園/散策/買い物)",
      "area_detail": "string",
      "opening_hours_note": "string|null",
      "estimated_stay_min": number,
      "why_recommended": "string",
      "url": "string|null",
      "source": "official|google_maps|tripadvisor|other|unknown",
      "verification": "verified|needs_verification"
    }
  ],
  "notes": ["string"]
}

最低でも restaurants 6件、attractions 6件を返す。
静かめ・お酒・景色などの好みがあれば、why_recommended に反映する。
""".strip(),
            expected_output="URL付き候補リスト(JSON)。",
            agent=self.agent_spot_researcher,
        )

    @property
    def task_build_itinerary(self) -> Task:
        return Task(
            description="""
【重要】回答は必ず日本語（JSON内の値も日本語）。

constraints JSON と candidates JSON を使い、最適化した行程を作成する。

要件：
- Plan A と Plan B の2案
- time_window に収める（nullなら『4時間』を仮置きし assumptions へ）
- 観光は sightseeing_max 以内、食事は meal 分
- 1km以上はタクシー（taxi_over_km）を優先。徒歩は1km未満を基本。
- 不確実な営業時間は check_opening_hours=true
- timeline各要素に url と verification を必ず入れる（不明なら null/needs_verification）

出力は JSON のみ。スキーマ：
{
  "plan_a": {
    "title": "string",
    "timeline": [
      {
        "start": "HH:MM",
        "end": "HH:MM",
        "activity_type": "meet|walk|attraction|meal|cafe|shopping|move|other",
        "name": "string",
        "area_detail": "string",
        "url": "string|null",
        "verification": "verified|needs_verification",
        "stay_min": number,
        "tips": ["string"],
        "check_opening_hours": true|false,
        "reservation_suggested": true|false,
        "move_mode": "walk|taxi|train|other"
      }
    ],
    "total_minutes": number,
    "estimated_cost_per_person_jpy": {"min": number|null, "max": number|null}
  },
  "plan_b": {
    "title": "string",
    "timeline": [
      {
        "start": "HH:MM",
        "end": "HH:MM",
        "activity_type": "meet|walk|attraction|meal|cafe|shopping|move|other",
        "name": "string",
        "area_detail": "string",
        "url": "string|null",
        "verification": "verified|needs_verification",
        "stay_min": number,
        "tips": ["string"],
        "check_opening_hours": true|false,
        "reservation_suggested": true|false,
        "move_mode": "walk|taxi|train|other"
      }
    ],
    "total_minutes": number,
    "estimated_cost_per_person_jpy": {"min": number|null, "max": number|null}
  },
  "optimization_notes": ["string"],
  "assumptions": ["string"]
}
""".strip(),
            expected_output="Plan A / Plan B 行程(JSON)。",
            agent=self.agent_itinerary_optimizer,
        )

    @property
    def task_finalize_output(self) -> Task:
        return Task(
            description="""
【最重要】出力はJSON形式のみ（マークダウン禁止）。

行程JSONを検証し、統合JSON形式で返す。

必須要件：
- 時間計算の整合性をチェックし、矛盾があれば修正する
- 全ての情報を構造化JSON形式で返す

出力スキーマ（JSONのみ）：
{
  "summary": {
    "total_duration_min": number,
    "mobility_policy": "string",
    "atmosphere": "string"
  },
  "plan_a": {
    "title": "string",
    "timeline": [
      {
        "start": "HH:MM",
        "end": "HH:MM",
        "activity_type": "meet|walk|attraction|meal|cafe|shopping|move|other",
        "name": "string",
        "area_detail": "string",
        "url": "string|null",
        "verification": "verified|needs_verification",
        "stay_min": number,
        "tips": ["string"],
        "check_opening_hours": true|false,
        "reservation_suggested": true|false,
        "move_mode": "walk|taxi|train|other"
      }
    ],
    "total_minutes": number,
    "estimated_cost_per_person_jpy": {"min": number|null, "max": number|null}
  },
  "plan_b": {
    "title": "string",
    "timeline": [...],
    "total_minutes": number,
    "estimated_cost_per_person_jpy": {"min": number|null, "max": number|null}
  },
  "notes": ["string"],
  "constraints": {...},
  "candidates": {...}
}

注意：
- JSONのみを出力する（マークダウンや説明文は含めない）
- JSONキーは英語のままで良い
- 出力は有効なJSON形式であること
""".strip(),
            expected_output="統合JSON（constraints + candidates + itinerary）。",
            agent=self.agent_quality_checker,
        )
