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

import asyncio
from uuid import uuid4

import pytest

import app.streams as streams_module
from app.streams import ChatStreamManager, HeartbeatEvent, MessageEvent


@pytest.mark.asyncio
async def test_publish_to_single_subscriber() -> None:
    manager = ChatStreamManager()
    chat_id = uuid4()
    events = []

    async with manager.subscribe(chat_id) as subscriber:

        async def consume() -> None:
            events.append(await asyncio.wait_for(subscriber.queue.get(), timeout=1))
            events.append(await asyncio.wait_for(subscriber.queue.get(), timeout=1))

        consumer_task = asyncio.create_task(consume())
        manager.publish(chat_id, MessageEvent(data={"content": "first"}))
        manager.publish(chat_id, MessageEvent(data={"content": "second"}))
        await consumer_task

    assert len(events) == 2
    assert events[0] is not None
    assert isinstance(events[0], MessageEvent)
    assert events[0].type == "message"
    assert events[0].data["content"] == "first"
    assert isinstance(events[1], MessageEvent)
    assert events[1].data["content"] == "second"
    assert manager.total_connections == 0


@pytest.mark.asyncio
async def test_publish_sets_disconnect_flag_when_queue_full(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(streams_module, "_QUEUE_MAXSIZE", 1)
    manager = ChatStreamManager()
    chat_id = uuid4()

    async with manager.subscribe(chat_id) as subscriber:
        manager.publish(chat_id, MessageEvent(data={"seq": 1}))
        assert subscriber.queue.qsize() == 1
        assert subscriber.should_disconnect is False

        manager.publish(chat_id, MessageEvent(data={"seq": 2}))
        assert subscriber.should_disconnect is True

        event = await asyncio.wait_for(subscriber.queue.get(), timeout=1)
        assert event.data["seq"] == 1

    assert manager.total_connections == 0


@pytest.mark.asyncio
async def test_queue_full_tries_to_put_none_sentinel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When queue is full, publish sets disconnect flag and tries to put None."""
    monkeypatch.setattr(streams_module, "_QUEUE_MAXSIZE", 2)
    manager = ChatStreamManager()
    chat_id = uuid4()

    async with manager.subscribe(chat_id) as subscriber:
        manager.publish(chat_id, MessageEvent(data={"seq": 1}))
        manager.publish(chat_id, MessageEvent(data={"seq": 2}))
        assert subscriber.queue.qsize() == 2
        assert subscriber.should_disconnect is False

        manager.publish(chat_id, MessageEvent(data={"seq": 3}))

        assert subscriber.should_disconnect is True
        assert subscriber.queue.qsize() == 2

    assert manager.total_connections == 0


@pytest.mark.asyncio
async def test_heartbeat_emits_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(streams_module, "_HEARTBEAT_SECONDS", 0)
    manager = ChatStreamManager()

    heartbeat_iter = manager.heartbeat()
    try:
        event = await asyncio.wait_for(anext(heartbeat_iter), timeout=1)
    finally:
        await heartbeat_iter.aclose()

    assert isinstance(event, HeartbeatEvent)
    assert event.type == "heartbeat"
    assert event.timestamp is not None
