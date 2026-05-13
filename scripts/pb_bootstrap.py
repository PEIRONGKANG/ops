#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from typing import Any
from urllib import request
from urllib.error import HTTPError


PB_URL = os.environ.get("PB_URL", "http://127.0.0.1:8090").rstrip("/")
SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL", "")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "")


def http_json(method: str, path: str, token: str | None = None, body: Any | None = None) -> Any:
    url = f"{PB_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw.decode("utf-8"))
    except HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", errors="replace")
        except Exception:
            detail = "<no body>"
        raise RuntimeError(f"{method} {path} failed: {exc.code} {detail}") from exc


def ensure(cond: bool, message: str) -> None:
    if not cond:
        raise SystemExit(message)


def auth_superuser() -> str:
    ensure(bool(SUPERUSER_EMAIL and SUPERUSER_PASSWORD), "Missing PB_SUPERUSER_EMAIL/PB_SUPERUSER_PASSWORD env vars.")
    payload = {"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD}
    data = http_json("POST", "/api/collections/_superusers/auth-with-password", body=payload)
    token = data.get("token")
    ensure(bool(token), "PocketBase auth failed.")
    return token


def list_collections(token: str) -> list[dict]:
    data = http_json("GET", "/api/collections?perPage=200", token=token)
    return list(data.get("items") or [])


def get_collection(token: str, name_or_id: str) -> dict:
    return http_json("GET", f"/api/collections/{name_or_id}", token=token)


def upsert_collection(token: str, schema: dict) -> dict:
    name = schema["name"]
    existing = None
    for col in list_collections(token):
        if col.get("name") == name:
            existing = col
            break
    if existing:
        # Update base collection rules/indexes/fields (best-effort).
        patch = dict(schema)
        patch["id"] = existing["id"]
        return http_json("PATCH", f"/api/collections/{existing['id']}", token=token, body=patch)
    return http_json("POST", "/api/collections", token=token, body=schema)


def ensure_user_fields(token: str) -> dict:
    col = get_collection(token, "users")
    fields = list(col.get("fields") or [])

    # PocketBase rejects `options: null` on update for some field types.
    # Normalize to omit null options entirely.
    normalized_fields = []
    for field in fields:
        clean = dict(field)
        if clean.get("options") is None:
            clean.pop("options", None)
        normalized_fields.append(clean)
    fields = normalized_fields
    by_name = {f.get("name"): f for f in fields}

    def add_field(field: dict) -> None:
        if field["name"] in by_name:
            return
        fields.append(field)

    add_field(
        {
            "name": "display_name",
            "type": "text",
            "required": False,
            "presentable": True,
            "system": False,
            "hidden": False,
            "min": 0,
            "max": 255,
            "pattern": "",
        }
    )
    add_field(
        {
            "name": "role_code",
            "type": "select",
            "required": True,
            "presentable": True,
            "system": False,
            "hidden": False,
            "maxSelect": 1,
            "values": ["P1", "T1", "P2", "P3"],
        }
    )
    add_field(
        {
            "name": "student_no",
            "type": "text",
            "required": False,
            "presentable": True,
            "system": False,
            "hidden": False,
            "min": 0,
            "max": 255,
            "pattern": "",
        }
    )
    add_field(
        {
            "name": "class_name",
            "type": "text",
            "required": False,
            "presentable": True,
            "system": False,
            "hidden": False,
            "min": 0,
            "max": 255,
            "pattern": "",
        }
    )
    add_field(
        {
            "name": "group_name",
            "type": "text",
            "required": False,
            "presentable": True,
            "system": False,
            "hidden": False,
            "min": 0,
            "max": 255,
            "pattern": "",
        }
    )

    patch = {
        "name": col["name"],
        "type": col["type"],
        "fields": fields,
        "listRule": "@request.auth.id != ''",
        "viewRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id = id || @request.auth.role_code = 'P1'",
        "deleteRule": "@request.auth.role_code = 'P1'",
        "options": col.get("options") or {},
    }
    updated = http_json("PATCH", f"/api/collections/{col['id']}", token=token, body=patch)
    return updated


def main() -> int:
    token = auth_superuser()

    users_col = ensure_user_fields(token)
    users_id = users_col["id"]

    # Base collections
    upsert_collection(
        token,
        {
            "name": "Students",
            "type": "base",
            "fields": [
                {"name": "name", "type": "text", "required": True, "presentable": True, "system": False, "hidden": False, "min": 0, "max": 255, "pattern": ""},
                {"name": "student_no", "type": "text", "required": True, "presentable": True, "system": False, "hidden": False, "min": 0, "max": 255, "pattern": ""},
                {"name": "class_name", "type": "text", "required": False, "presentable": True, "system": False, "hidden": False, "min": 0, "max": 255, "pattern": ""},
                {"name": "group_name", "type": "text", "required": False, "presentable": True, "system": False, "hidden": False, "min": 0, "max": 255, "pattern": ""},
                {
                    "name": "role_code",
                    "type": "select",
                    "required": True,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "maxSelect": 1,
                    "values": ["P1", "T1", "P2", "P3"],
                },
                {"name": "training_progress", "type": "number", "required": False, "presentable": True, "system": False, "hidden": False, "min": None, "max": None},
                {
                    "name": "current_status",
                    "type": "select",
                    "required": False,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "maxSelect": 1,
                    "values": ["not_started", "in_progress", "submitted", "completed", "overdue"],
                },
                {
                    "name": "user_id",
                    "type": "relation",
                    "required": False,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "collectionId": users_id,
                    "cascadeDelete": False,
                    "minSelect": 0,
                    "maxSelect": 1,
                    "displayFields": None,
                },
                {
                    "name": "avatar",
                    "type": "file",
                    "required": False,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "maxSelect": 1,
                    "maxSize": 5 * 1024 * 1024,
                    "mimeTypes": ["image/jpeg", "image/png", "image/webp"],
                    "thumbs": None,
                    "protected": False,
                },
                {"name": "last_login_at", "type": "date", "required": False, "presentable": True, "system": False, "hidden": False},
            ],
            "indexes": [
                "CREATE UNIQUE INDEX idx_students_student_no ON Students(student_no)",
            ],
            "listRule": "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role_code != 'P3')",
            "viewRule": "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role_code != 'P3')",
            "createRule": "@request.auth.role_code = 'P1'",
            "updateRule": "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role_code = 'P1')",
            "deleteRule": "@request.auth.role_code = 'P1'",
        },
    )

    cols = {c["name"]: c["id"] for c in list_collections(token)}
    students_id = cols.get("Students") or "Students"

    upsert_collection(
        token,
        {
            "name": "Training_Tasks",
            "type": "base",
            "fields": [
                {"name": "task_name", "type": "text", "required": True, "presentable": True, "system": False, "hidden": False, "min": 0, "max": 255, "pattern": ""},
                {"name": "module_code", "type": "text", "required": False, "presentable": True, "system": False, "hidden": False, "min": 0, "max": 255, "pattern": ""},
                {"name": "markdown_content", "type": "editor", "required": False, "presentable": True, "system": False, "hidden": False},
                {"name": "interactive_exercise", "type": "json", "required": False, "presentable": True, "system": False, "hidden": False},
                {"name": "deadline", "type": "date", "required": False, "presentable": True, "system": False, "hidden": False},
                {"name": "total_score", "type": "number", "required": False, "presentable": True, "system": False, "hidden": False, "min": None, "max": None},
                {
                    "name": "status",
                    "type": "select",
                    "required": True,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "maxSelect": 1,
                    "values": ["draft", "published", "closed", "archived"],
                },
                {"name": "sort_order", "type": "number", "required": False, "presentable": True, "system": False, "hidden": False, "min": None, "max": None},
                {
                    "name": "created_by",
                    "type": "relation",
                    "required": False,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "collectionId": users_id,
                    "cascadeDelete": False,
                    "minSelect": 0,
                    "maxSelect": 1,
                    "displayFields": None,
                },
            ],
            "listRule": "@request.auth.id != ''",
            "viewRule": "@request.auth.id != ''",
            "createRule": "@request.auth.role_code = 'P1' || @request.auth.role_code = 'T1'",
            "updateRule": "@request.auth.role_code = 'P1' || @request.auth.role_code = 'T1'",
            "deleteRule": "@request.auth.role_code = 'P1'",
        },
    )

    cols = {c["name"]: c["id"] for c in list_collections(token)}
    tasks_id = cols.get("Training_Tasks") or "Training_Tasks"

    upsert_collection(
        token,
        {
            "name": "Submissions",
            "type": "base",
            "fields": [
                {
                    "name": "student_id",
                    "type": "relation",
                    "required": True,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "collectionId": students_id,
                    "cascadeDelete": True,
                    "minSelect": 0,
                    "maxSelect": 1,
                    "displayFields": None,
                },
                {
                    "name": "task_id",
                    "type": "relation",
                    "required": True,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "collectionId": tasks_id,
                    "cascadeDelete": True,
                    "minSelect": 0,
                    "maxSelect": 1,
                    "displayFields": None,
                },
                {"name": "submitted_answer", "type": "json", "required": False, "presentable": True, "system": False, "hidden": False},
                {"name": "score", "type": "number", "required": False, "presentable": True, "system": False, "hidden": False, "min": None, "max": None},
                {"name": "is_correct", "type": "bool", "required": False, "presentable": True, "system": False, "hidden": False},
                {"name": "feedback", "type": "text", "required": False, "presentable": True, "system": False, "hidden": False},
                {
                    "name": "status",
                    "type": "select",
                    "required": False,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "maxSelect": 1,
                    "values": ["draft", "submitted", "completed", "revision_required", "reviewed"],
                },
                {"name": "submitted_at", "type": "date", "required": False, "presentable": True, "system": False, "hidden": False},
                {
                    "name": "reviewed_by",
                    "type": "relation",
                    "required": False,
                    "presentable": True,
                    "system": False,
                    "hidden": False,
                    "collectionId": users_id,
                    "cascadeDelete": False,
                    "minSelect": 0,
                    "maxSelect": 1,
                    "displayFields": None,
                },
                {"name": "reviewed_at", "type": "date", "required": False, "presentable": True, "system": False, "hidden": False},
                {"name": "teacher_comment", "type": "text", "required": False, "presentable": True, "system": False, "hidden": False},
            ],
            "indexes": ["CREATE UNIQUE INDEX idx_submissions_unique ON Submissions(student_id, task_id)"],
            "listRule": "@request.auth.id != '' && (@request.auth.role_code != 'P3' || student_id.user_id = @request.auth.id)",
            "viewRule": "@request.auth.id != '' && (@request.auth.role_code != 'P3' || student_id.user_id = @request.auth.id)",
            "createRule": "@request.auth.id != '' && (@request.auth.role_code != 'P3' || student_id.user_id = @request.auth.id)",
            "updateRule": "@request.auth.id != '' && (@request.auth.role_code != 'P3' || student_id.user_id = @request.auth.id)",
            "deleteRule": "@request.auth.role_code = 'P1'",
        },
    )

    print("PocketBase bootstrap: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
