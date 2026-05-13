#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib import parse, request
from urllib.error import HTTPError


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get("OPS_TRAINING_DB_PATH", ROOT / "backend" / "data" / "ops_training.db"))
PB_URL = os.environ.get("PB_URL") or os.environ.get("OPS_POCKETBASE_INTERNAL_URL", "http://127.0.0.1:8090")
PB_URL = PB_URL.rstrip("/")
SUPERUSER_EMAIL = os.environ.get("PB_SUPERUSER_EMAIL") or os.environ.get("OPS_PB_SUPERUSER_EMAIL", "")
SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD") or os.environ.get("OPS_PB_SUPERUSER_PASSWORD", "")


def http_json(method: str, path: str, token: str | None = None, body: Any | None = None, params: dict | None = None) -> Any:
    query = f"?{parse.urlencode(params)}" if params else ""
    req = request.Request(
        f"{PB_URL}{path}{query}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method=method,
    )
    try:
        with request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8")) if raw else None
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: {exc.code} {detail}") from exc


def auth() -> str:
    if not SUPERUSER_EMAIL or not SUPERUSER_PASSWORD:
        raise SystemExit("Missing PB_SUPERUSER_EMAIL/PB_SUPERUSER_PASSWORD.")
    data = http_json(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        body={"identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD},
    )
    return data["token"]


def list_records(token: str, collection: str, filter_expr: str = "", sort: str = "") -> list[dict]:
    items: list[dict] = []
    page = 1
    while True:
        params = {"page": page, "perPage": 200}
        if filter_expr:
            params["filter"] = filter_expr
        if sort:
            params["sort"] = sort
        data = http_json("GET", f"/api/collections/{collection}/records", token, params=params)
        batch = list(data.get("items") or [])
        items.extend(batch)
        if page >= int(data.get("totalPages") or 1):
            return items
        page += 1


def first_record(token: str, collection: str, filter_expr: str) -> dict | None:
    items = list_records(token, collection, filter_expr=filter_expr)
    return items[0] if items else None


def legacy_p3_users() -> list[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT username, display_name, level, role, owner_type
            FROM users
            WHERE level = 'P3'
            ORDER BY username
            """
        ).fetchall()
    return [dict(row) for row in rows]


def pb_date(value: date) -> str:
    return datetime.combine(value, datetime.min.time()).astimezone().isoformat(timespec="seconds")


def ensure_default_semester(token: str) -> dict:
    display_name = "2025-2026 学年 第二学期（春季学期）"
    existing = first_record(token, "Semesters", f'display_name="{display_name}"')
    if existing:
        return {"semester": existing, "created": False, "weeksCreated": 0}

    semester = http_json(
        "POST",
        "/api/collections/Semesters/records",
        token,
        body={
            "academic_year_start": 2025,
            "academic_year_end": 2026,
            "semester_number": "第二学期",
            "season": "春季学期",
            "display_name": display_name,
            "first_week_start_date": pb_date(date(2026, 3, 4)),
            "weeks_count": 18,
            "status": "active",
            "created_by": "sync_script",
        },
    )
    today = date.today()
    for i in range(18):
        start = date(2026, 3, 4) + timedelta(days=i * 7)
        http_json(
            "POST",
            "/api/collections/Teaching_Weeks/records",
            token,
            body={
                "semester_id": semester["id"],
                "week_number": i + 1,
                "start_date": pb_date(start),
                "end_date": pb_date(start + timedelta(days=6)),
                "display_name": f"第{i + 1}周",
                "is_current": start <= today <= start + timedelta(days=6),
            },
        )
    return {"semester": semester, "created": True, "weeksCreated": 18}


def ensure_training_tasks(token: str) -> dict:
    seeds = [
        {
            "task_name": "个人信息保护单选题",
            "module_code": "privacy",
            "markdown_content": "## 个人信息保护\n\n客户电话、订单信息、刷卡单据均需妥善保存。\n\n| 场景 | 要求 |\n| --- | --- |\n| 电话号码 | 部分折叠或遮挡 |\n| 签名单 | 统一保存 |\n\n> 不得把客户信息用于无关场景。\n\n```text\n接触客户信息前，先判断是否与本次服务直接相关。\n```",
            "interactive_exercise": {
                "type": "single_choice",
                "question": "以下哪一项属于个人信息保护的正确做法？",
                "options": [
                    {"label": "A", "text": "将客户电话写在便签上并随意放在吧台"},
                    {"label": "B", "text": "客户订单中电话号码部分应折叠或隐藏"},
                    {"label": "C", "text": "将刷卡单底联拍照发到群里"},
                    {"label": "D", "text": "把客户资料用于其他无关用途"},
                ],
                "answer": ["B"],
                "explanation": "客户姓名、电话、订单、刷卡单等都属于需要谨慎管理的信息。",
                "score": 10,
            },
            "total_score": 10,
            "status": "published",
            "sort_order": 1,
        },
        {
            "task_name": "个人信息保护多选题",
            "module_code": "privacy",
            "markdown_content": "## 个人信息保护多选\n\n请选择所有符合要求的做法。",
            "interactive_exercise": {
                "type": "multiple_choice",
                "question": "以下哪些做法符合个人信息保护要求？",
                "options": [
                    {"label": "A", "text": "客户订单中电话号码部分应折叠或隐藏"},
                    {"label": "B", "text": "银行卡签名单底联应统一保存"},
                    {"label": "C", "text": "将客户信息用于无关宣传"},
                    {"label": "D", "text": "不将客户信息用于原使用目的以外的场景"},
                ],
                "answer": ["A", "B", "D"],
                "explanation": "信息保护要做到最小必要、统一保管、不得外传或挪用。",
                "score": 15,
            },
            "total_score": 15,
            "status": "published",
            "sort_order": 2,
        },
        {
            "task_name": "电话礼貌用语文本输入题",
            "module_code": "service_etiquette",
            "markdown_content": "## 电话礼貌用语\n\n当客户找的同事不在时，应先致歉，再说明情况，最后记录联系方式并承诺回电。",
            "interactive_exercise": {
                "type": "text_input",
                "question": "当客户询问某位同事但该同事不在时，请输入一句合适的礼貌回应。",
                "keywords": ["不好意思", "不在", "留下联系方式", "回电"],
                "answer": "不好意思，他现在不在。您可以留下联系方式，我会转告他尽快给您回电。",
                "explanation": "关键表达包括致歉、说明不在、留下联系方式、承诺回电。",
                "score": 15,
            },
            "total_score": 15,
            "status": "published",
            "sort_order": 3,
        },
    ]

    created = 0
    skipped = 0
    for seed in seeds:
        existing = first_record(token, "Training_Tasks", f'task_name="{seed["task_name"]}"')
        if existing:
            skipped += 1
            continue
        http_json("POST", "/api/collections/Training_Tasks/records", token, body=seed)
        created += 1
    return {"created": created, "skipped": skipped}


def sync_students(token: str) -> dict:
    legacy = legacy_p3_users()
    existing = {item.get("student_no"): item for item in list_records(token, "Students")}
    added = 0
    skipped = 0
    failed: list[dict] = []
    for user in legacy:
        student_no = str(user["username"])
        if student_no in existing:
            skipped += 1
            continue
        try:
            http_json(
                "POST",
                "/api/collections/Students/records",
                token,
                body={
                    "name": user.get("display_name") or student_no,
                    "student_no": student_no,
                    "class_name": "",
                    "group_name": "",
                    "role_code": "P3",
                    "training_progress": 0,
                    "current_status": "not_started",
                    "last_login_at": "",
                },
            )
            added += 1
        except Exception as exc:
            failed.append({"student_no": student_no, "error": str(exc)})
    final_total = len(list_records(token, "Students"))
    return {
        "legacyP3": len(legacy),
        "pbStudentsBefore": len(existing),
        "added": added,
        "skipped": skipped,
        "pbStudentsAfter": final_total,
        "failed": failed,
    }


def main() -> int:
    token = auth()
    report = {
        "students": sync_students(token),
        "semester": ensure_default_semester(token),
        "trainingTasks": ensure_training_tasks(token),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
