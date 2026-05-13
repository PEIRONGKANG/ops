from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class PocketBaseConfig:
    url: str
    email: str
    password: str


class PocketBaseClient:
    def __init__(self, config: PocketBaseConfig):
        self._config = config
        self._token: str | None = None
        self._token_exp: int | None = None

    def _jwt_exp(self, token: str) -> int | None:
        try:
            parts = token.split(".")
            if len(parts) < 2:
                return None
            payload_b64 = parts[1]
            payload_b64 += "=" * (-len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")))
            exp = payload.get("exp")
            return int(exp) if exp else None
        except Exception:
            return None

    async def _ensure_token(self) -> str:
        if self._token and self._token_exp and self._token_exp - int(time.time()) > 60:
            return self._token
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0)) as client:
            resp = await client.post(
                f"{self._config.url}/api/collections/_superusers/auth-with-password",
                json={"identity": self._config.email, "password": self._config.password},
            )
            resp.raise_for_status()
            data = resp.json()
            token = data.get("token")
            if not token:
                raise RuntimeError("PocketBase auth failed: missing token")
            self._token = token
            self._token_exp = self._jwt_exp(token)
            return token

    async def request(self, method: str, path: str, *, params: dict | None = None, json_body: Any | None = None) -> Any:
        token = await self._ensure_token()
        url = f"{self._config.url}{path}"
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            resp = await client.request(
                method,
                url,
                params=params,
                json=json_body,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            if resp.status_code == 204:
                return None
            return resp.json()


def get_pocketbase_client() -> PocketBaseClient:
    url = os.environ.get("OPS_POCKETBASE_INTERNAL_URL", "http://127.0.0.1:8090").rstrip("/")
    email = os.environ.get("OPS_PB_SUPERUSER_EMAIL", "")
    password = os.environ.get("OPS_PB_SUPERUSER_PASSWORD", "")
    if not email or not password:
        raise RuntimeError("Missing OPS_PB_SUPERUSER_EMAIL/OPS_PB_SUPERUSER_PASSWORD env vars.")
    return PocketBaseClient(PocketBaseConfig(url=url, email=email, password=password))

