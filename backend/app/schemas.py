from typing import Any

from pydantic import BaseModel, Field


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


class TeacherNoticePayload(BaseModel):
    title: str = ""
    message: str = ""
    images: list[str] = Field(default_factory=list)
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
    receipts: list[TeacherNoticeReceiptItem] = Field(default_factory=list)
