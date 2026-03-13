from typing import Any, Dict, List, Optional

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


class TermPayload(BaseModel):
    code: str
    name: str


class ClassPayload(BaseModel):
    code: str
    name: str


class CourseBatchPayload(BaseModel):
    name: str
    courseName: str
    termId: Optional[int] = None
    classIds: List[int] = Field(default_factory=list)
    startWeek: int = 1
    endWeek: int = 18
    exportTemplateVersion: str = "v1"


class GroupPayload(BaseModel):
    batchId: int
    name: str
    sequence: int
    handoverGroupId: Optional[int] = None


class GroupMemberPayload(BaseModel):
    groupId: int
    studentUsername: str


class ScheduleAssignmentPayload(BaseModel):
    batchId: int
    teachingWeek: str
    weekStartDate: str = ""
    primaryGroupId: int
    secondaryGroupId: Optional[int] = None
    notes: str = ""


class ResourcePayload(BaseModel):
    title: str
    category: str
    description: str = ""
    fileName: str = ""
    fileData: str = ""
    externalUrl: str = ""
