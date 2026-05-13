from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class WeekPayload(BaseModel):
    week: Dict[str, Any]


class WeekGroupPayload(BaseModel):
    group: Dict[str, Any]


class UserPayload(BaseModel):
    username: str
    password: str
    role: str
    level: str
    displayName: str
    ownerType: str = ""
    passwordUpdatedAt: str = ""
    nameUpdatedAt: str = ""
    isActive: bool = True


class TeacherNoticePayload(BaseModel):
    title: str = ""
    message: str = ""
    images: List[str] = Field(default_factory=list)
    authorUsername: str = ""
    authorDisplayName: str = ""
    createdAt: str = ""
    updatedAt: str = ""


class TeacherNoticeReceiptItem(BaseModel):
    username: str
    displayName: str = ""
    level: str = ""
    receivedAt: str = ""


class TeacherNoticeReceiptPayload(BaseModel):
    receipts: List[TeacherNoticeReceiptItem] = Field(default_factory=list)
