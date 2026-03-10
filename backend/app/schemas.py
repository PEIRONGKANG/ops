from typing import Any

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class WeekPayload(BaseModel):
    week: dict[str, Any]


class WeekGroupPayload(BaseModel):
    group: dict[str, Any]


class UserPayload(BaseModel):
    username: str
    password: str
    role: str
    level: str
    displayName: str
    ownerType: str = ""
    passwordUpdatedAt: str = ""
    nameUpdatedAt: str = ""
