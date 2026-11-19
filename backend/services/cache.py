import asyncio
import json
from collections import OrderedDict
from collections.abc import Callable, Hashable
from datetime import date, datetime
from typing import Any

from fastapi import Response


class LruCache:
    def __init__(self, max_items: int) -> None:
        self._items: OrderedDict[Hashable, Any] = OrderedDict()
        self._max_items = max_items

    def __len__(self) -> int:
        return len(self._items)

    def get(self, key: Hashable) -> Any | None:
        value = self._items.get(key)
        if value is not None:
            self._items.move_to_end(key)
        return value

    def set(self, key: Hashable, value: Any) -> None:
        self._items[key] = value
        self._items.move_to_end(key)
        while len(self._items) > self._max_items:
            self._items.popitem(last=False)

    def clear(self) -> int:
        count = len(self._items)
        self._items.clear()
        return count


def _default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(f"Не сериализуется в JSON: {type(value).__name__}")


def encode(data: Any) -> bytes:
    return json.dumps(
        data, ensure_ascii=False, separators=(",", ":"), default=_default,
    ).encode("utf-8")


async def cached(
    cache: LruCache, key: Hashable, build: Callable[[], Any],
) -> Response:
    body = cache.get(key)
    if body is None:
        body = await asyncio.to_thread(lambda: encode(build()))
        cache.set(key, body)
    return Response(body, media_type="application/json")
