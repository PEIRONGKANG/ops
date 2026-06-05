from __future__ import annotations

import copy
import base64
import hashlib
import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from datetime import timedelta

from .password_crypto import decrypt_password, encrypt_password, is_encrypted_password


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "backend" / "data"
DB_PATH = Path(os.environ.get("OPS_TRAINING_DB_PATH", DATA_DIR / "ops_training.db"))
MEDIA_DIR = Path(os.environ.get("OPS_TRAINING_MEDIA_DIR", DATA_DIR / "media"))
IMAGE_PLACEHOLDER = "__OPS_IMAGE_PENDING__"

_DATA_URL_RE = re.compile(r"^data:(?P<mime>[^;]+);base64,(?P<b64>.+)$", re.DOTALL)


def _media_ext(mime: str) -> str:
    value = (mime or "").lower().strip()
    if value == "image/jpeg":
        return ".jpg"
    if value == "image/png":
        return ".png"
    if value == "image/webp":
        return ".webp"
    if value == "image/gif":
        return ".gif"
    if value == "video/mp4":
        return ".mp4"
    # Fallback for uncommon types.
    return ""


def store_data_url(value: str) -> str:
    """Persist a data: URL to disk and return a URL path to serve it."""
    if not isinstance(value, str) or not value.startswith("data:"):
        return value
    match = _DATA_URL_RE.match(value)
    if not match:
        return value

    mime = match.group("mime")
    try:
        raw = base64.b64decode(match.group("b64"), validate=False)
    except Exception:
        return value

    digest = hashlib.sha256(raw).hexdigest()
    ext = _media_ext(mime)
    filename = f"{digest}{ext}" if ext else digest
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    target = MEDIA_DIR / filename
    if not target.exists():
        tmp = MEDIA_DIR / f".tmp-{uuid4().hex}"
        tmp.write_bytes(raw)
        tmp.replace(target)

    return f"/media/{filename}"


def normalize_payload_media(payload: object) -> object:
    """Replace embedded data URLs with server-hosted URLs to keep DB payloads small."""
    if isinstance(payload, dict):
        return {k: normalize_payload_media(v) for k, v in payload.items()}
    if isinstance(payload, list):
        return [normalize_payload_media(v) for v in payload]
    if isinstance(payload, str) and payload.startswith("data:"):
        return store_data_url(payload)
    return payload


DEFAULT_USERS = [
    {"username": "2401270101", "password": "2401270101", "role": "student", "level": "P3", "display_name": "周露", "owner_type": "Student"},
    {"username": "2401270102", "password": "2401270102", "role": "student", "level": "P3", "display_name": "刘静", "owner_type": "Student"},
    {"username": "2401270103", "password": "2401270103", "role": "student", "level": "P3", "display_name": "夏婧尔", "owner_type": "Student"},
    {"username": "2401270104", "password": "2401270104", "role": "student", "level": "P3", "display_name": "周熳", "owner_type": "Student"},
    {"username": "2401270105", "password": "2401270105", "role": "student", "level": "P3", "display_name": "吴睿", "owner_type": "Student"},
    {"username": "2401270106", "password": "2401270106", "role": "student", "level": "P3", "display_name": "刘梓文", "owner_type": "Student"},
    {"username": "2401270107", "password": "2401270107", "role": "student", "level": "P3", "display_name": "徐冰芯", "owner_type": "Student"},
    {"username": "2401270108", "password": "2401270108", "role": "student", "level": "P3", "display_name": "姚莹", "owner_type": "Student"},
    {"username": "2401270109", "password": "2401270109", "role": "student", "level": "P3", "display_name": "江丹丹", "owner_type": "Student"},
    {"username": "2401270110", "password": "2401270110", "role": "student", "level": "P3", "display_name": "杨典睿", "owner_type": "Student"},
    {"username": "2401270111", "password": "2401270111", "role": "student", "level": "P3", "display_name": "方飘一", "owner_type": "Student"},
    {"username": "2401280101", "password": "2401280101", "role": "student", "level": "P3", "display_name": "周园", "owner_type": "Student"},
    {"username": "2401280102", "password": "2401280102", "role": "student", "level": "P3", "display_name": "王奕婷", "owner_type": "Student"},
    {"username": "2401280104", "password": "2401280104", "role": "student", "level": "P3", "display_name": "马一", "owner_type": "Student"},
    {"username": "2401280106", "password": "2401280106", "role": "student", "level": "P3", "display_name": "李佳欣", "owner_type": "Student"},
    {"username": "2401280107", "password": "2401280107", "role": "student", "level": "P3", "display_name": "宋文琪", "owner_type": "Student"},
    {"username": "2401280108", "password": "2401280108", "role": "student", "level": "P3", "display_name": "陈仲宇", "owner_type": "Student"},
    {"username": "2401280109", "password": "2401280109", "role": "student", "level": "P3", "display_name": "刘宇骢", "owner_type": "Student"},
    {"username": "2401280110", "password": "2401280110", "role": "student", "level": "P3", "display_name": "邢梦婷", "owner_type": "Student"},
    {"username": "2401280112", "password": "2401280112", "role": "student", "level": "P3", "display_name": "马子晗", "owner_type": "Student"},
    {"username": "2401280113", "password": "2401280113", "role": "student", "level": "P3", "display_name": "付竹妍", "owner_type": "Student"},
    {"username": "2401280114", "password": "2401280114", "role": "student", "level": "P3", "display_name": "罗奎", "owner_type": "Student"},
    {"username": "2401280115", "password": "2401280115", "role": "student", "level": "P3", "display_name": "袁梦琪", "owner_type": "Student"},
    {"username": "2401280117", "password": "2401280117", "role": "student", "level": "P3", "display_name": "胡曼青", "owner_type": "Student"},
    {"username": "2401280118", "password": "2401280118", "role": "student", "level": "P3", "display_name": "张子洁", "owner_type": "Student"},
    {"username": "2401280119", "password": "2401280119", "role": "student", "level": "P3", "display_name": "张慧琳", "owner_type": "Student"},
    {"username": "2401280120", "password": "2401280120", "role": "student", "level": "P3", "display_name": "刘月", "owner_type": "Student"},
    {"username": "103085", "password": "103085", "role": "admin", "level": "P1", "display_name": "周欣", "owner_type": "Teacher"},
    {"username": "122019", "password": "122019", "role": "admin", "level": "P1", "display_name": "裴荣康", "owner_type": "Teacher"},
    {"username": "t1_teacher", "password": "t1_teacher", "role": "supervisor", "level": "T1", "display_name": "运营督查测试账号", "owner_type": "Supervisor"},
    {"username": "2301180107", "password": "2301180107", "role": "manager", "level": "P2", "display_name": "史燕香", "owner_type": "OM(Operations Manager)"},
    {"username": "425021", "password": "425021", "role": "admin", "level": "P1", "display_name": "王谦", "owner_type": "Teacher"},
]


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _row_to_user(row: sqlite3.Row) -> dict:
    return {
        "username": row["username"],
        "password": row["password"],
        "role": row["role"],
        "level": row["level"],
        "displayName": row["display_name"],
        "ownerType": row["owner_type"],
        "passwordUpdatedAt": row["password_updated_at"],
        "nameUpdatedAt": row["name_updated_at"],
        "isActive": bool(row["is_active"]) if "is_active" in row.keys() else True,
        "createdAt": row["created_at"] if "created_at" in row.keys() else "",
        "lastLoginAt": row["last_login_at"] if "last_login_at" in row.keys() else "",
    }


def _redact_password(user: dict) -> dict:
    safe = {**user}
    safe["password"] = ""
    return safe


def _ensure_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _row_to_notice_receipt(row: sqlite3.Row) -> dict:
    return {
        "username": row["username"],
        "displayName": row["display_name"],
        "level": row["level"],
        "receivedAt": row["received_at"],
    }


def _row_to_teacher_notice(row: sqlite3.Row, receipts: list[dict] | None = None) -> dict:
    try:
        images = json.loads(row["images"] or "[]")
    except json.JSONDecodeError:
        images = []

    return {
        "id": row["id"],
        "title": row["title"],
        "message": row["message"],
        "images": images if isinstance(images, list) else [],
        "authorUsername": row["author_username"],
        "authorDisplayName": row["author_display_name"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "receipts": receipts or [],
    }


def _row_to_job_position(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "isActive": bool(row["is_active"]),
        "sortOrder": int(row["sort_order"] or 0),
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_job_assignment(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "studentUsername": row["student_username"],
        "studentName": row["student_name"],
        "workDate": row["work_date"],
        "slotStart": row["slot_start"],
        "slotEnd": row["slot_end"],
        "positionId": row["position_id"],
        "positionName": row["position_name"],
        "assignedBy": row["assigned_by"],
        "assignedByName": row["assigned_by_name"],
        "note": row["note"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                level TEXT NOT NULL,
                display_name TEXT NOT NULL,
                owner_type TEXT NOT NULL DEFAULT '',
                password_updated_at TEXT NOT NULL DEFAULT '',
                name_updated_at TEXT NOT NULL DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT '',
                last_login_at TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS week_groups (
                start_date TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS weeks (
                scope_user TEXT NOT NULL,
                start_date TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (scope_user, start_date)
            );

            CREATE TABLE IF NOT EXISTS teacher_notices (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                message TEXT NOT NULL DEFAULT '',
                images TEXT NOT NULL DEFAULT '[]',
                author_username TEXT NOT NULL DEFAULT '',
                author_display_name TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS teacher_notice_receipts (
                notice_id TEXT NOT NULL,
                username TEXT NOT NULL,
                display_name TEXT NOT NULL DEFAULT '',
                level TEXT NOT NULL DEFAULT '',
                received_at TEXT NOT NULL,
                PRIMARY KEY (notice_id, username)
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS operation_logs (
                id TEXT PRIMARY KEY,
                actor_username TEXT NOT NULL DEFAULT '',
                actor_level TEXT NOT NULL DEFAULT '',
                action TEXT NOT NULL,
                target_type TEXT NOT NULL DEFAULT '',
                target_id TEXT NOT NULL DEFAULT '',
                detail TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS job_positions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_by TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS job_assignments (
                id TEXT PRIMARY KEY,
                student_username TEXT NOT NULL,
                student_name TEXT NOT NULL DEFAULT '',
                work_date TEXT NOT NULL,
                slot_start TEXT NOT NULL,
                slot_end TEXT NOT NULL,
                position_id TEXT NOT NULL,
                position_name TEXT NOT NULL,
                assigned_by TEXT NOT NULL DEFAULT '',
                assigned_by_name TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(student_username, work_date, slot_start)
            );
            """
        )
        _ensure_column(connection, "users", "is_active", "INTEGER NOT NULL DEFAULT 1")
        _ensure_column(connection, "users", "created_at", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(connection, "users", "last_login_at", "TEXT NOT NULL DEFAULT ''")

        existing = {
            row["username"]
            for row in connection.execute("SELECT username FROM users")
        }
        for user in DEFAULT_USERS:
            if user["username"] in existing:
                continue
            connection.execute(
                """
                INSERT INTO users (
                    username, password, role, level, display_name,
                    owner_type, password_updated_at, name_updated_at,
                    is_active, created_at, last_login_at
                ) VALUES (?, ?, ?, ?, ?, ?, '', '', 1, ?, '')
                """,
                (
                    user["username"],
                    encrypt_password(user["password"]),
                    user["role"],
                    user["level"],
                    user["display_name"],
                    user["owner_type"],
                    _now_iso(),
                ),
            )
        rows = connection.execute("SELECT username, password FROM users").fetchall()
        for row in rows:
            if not is_encrypted_password(row["password"]):
                connection.execute(
                    "UPDATE users SET password = ? WHERE username = ?",
                    (encrypt_password(row["password"]), row["username"]),
                )
        default_positions = [
            ("物料补给", "负责吧台与仓储物料补充，记录低库存与补货建议。"),
            ("公区维护", "负责公共区域卫生、动线检查与服务环境维护。"),
            ("库存盘点", "负责物料数量核对、安全线检查和盘点记录。"),
            ("吧台主岗", "负责饮品制作、出品标准和吧台设备检查。"),
            ("收银与财务", "负责订单、收银、票据和日结财务记录。"),
            ("服务接待", "负责客户接待、电话礼仪和现场引导沟通。"),
        ]
        existing_positions = {
            row["name"]
            for row in connection.execute("SELECT name FROM job_positions")
        }
        for index, (name, description) in enumerate(default_positions, start=1):
            if name in existing_positions:
                continue
            timestamp = _now_iso()
            connection.execute(
                """
                INSERT INTO job_positions (
                    id, name, description, is_active, sort_order,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, 1, ?, 'system', ?, ?)
                """,
                (uuid4().hex, name, description, index, timestamp, timestamp),
            )
        connection.commit()


def create_session(username: str, days: int = 14) -> dict:
    token = uuid4().hex
    now = datetime.now().astimezone()
    created_at = now.isoformat(timespec="seconds")
    expires_at = (now + timedelta(days=days)).isoformat(timespec="seconds")
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO sessions (token, username, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, username, created_at, expires_at),
        )
        connection.commit()
    return {"token": token, "username": username, "createdAt": created_at, "expiresAt": expires_at}


def get_session(token: str) -> dict | None:
    if not token:
        return None
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT token, username, created_at, expires_at
            FROM sessions
            WHERE token = ?
            """,
            (token,),
        ).fetchone()
    if not row:
        return None
    try:
        expires_at = datetime.fromisoformat(row["expires_at"])
    except Exception:
        return None
    if expires_at < datetime.now().astimezone():
        delete_session(token)
        return None
    return {"token": row["token"], "username": row["username"], "createdAt": row["created_at"], "expiresAt": row["expires_at"]}


def delete_session(token: str) -> None:
    if not token:
        return
    with get_connection() as connection:
        connection.execute("DELETE FROM sessions WHERE token = ?", (token,))
        connection.commit()


def list_users() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT username, password, role, level, display_name,
                   owner_type, password_updated_at, name_updated_at,
                   is_active, created_at, last_login_at
            FROM users
            ORDER BY username
            """
        ).fetchall()
    return [_row_to_user(row) for row in rows]


def list_users_for_client(include_passwords: bool = False, passphrase: str | None = None) -> list[dict]:
    users = list_users()
    if not include_passwords:
        return [_redact_password(user) for user in users]
    return [{**user, "password": decrypt_password(user.get("password", ""), passphrase)} for user in users]


def get_user(username: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT username, password, role, level, display_name,
                   owner_type, password_updated_at, name_updated_at,
                   is_active, created_at, last_login_at
            FROM users
            WHERE username = ?
            """,
            (username,),
        ).fetchone()
    return _row_to_user(row) if row else None


def verify_user(username: str, password: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT username, password, role, level, display_name,
                   owner_type, password_updated_at, name_updated_at,
                   is_active, created_at, last_login_at
            FROM users
            WHERE username = ? AND is_active = 1
            """,
            (username,),
        ).fetchone()
        if row and decrypt_password(row["password"]) == password:
            connection.execute(
                "UPDATE users SET last_login_at = ? WHERE username = ?",
                (_now_iso(), username),
            )
            connection.commit()
            return _row_to_user(row)
    return None


def create_user(payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO users (
                username, password, role, level, display_name,
                owner_type, password_updated_at, name_updated_at,
                is_active, created_at, last_login_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["username"],
                encrypt_password(payload["password"]),
                payload["role"],
                payload["level"],
                payload["displayName"],
                payload.get("ownerType", ""),
                payload.get("passwordUpdatedAt", ""),
                payload.get("nameUpdatedAt", ""),
                1 if payload.get("isActive", True) else 0,
                payload.get("createdAt") or _now_iso(),
                payload.get("lastLoginAt", ""),
            ),
        )
        connection.commit()
    return get_user(payload["username"])


def update_user(username: str, payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE users
            SET password = ?,
                role = ?,
                level = ?,
                display_name = ?,
                owner_type = ?,
                password_updated_at = ?,
                name_updated_at = ?,
                is_active = ?
            WHERE username = ?
            """,
            (
                encrypt_password(payload["password"]),
                payload["role"],
                payload["level"],
                payload["displayName"],
                payload.get("ownerType", ""),
                payload.get("passwordUpdatedAt", ""),
                payload.get("nameUpdatedAt", ""),
                1 if payload.get("isActive", True) else 0,
                username,
            ),
        )
        connection.commit()
    return get_user(username)


def create_operation_log(actor: dict | None, action: str, target_type: str = "", target_id: str = "", detail: dict | None = None) -> dict:
    log_id = uuid4().hex
    row = {
        "id": log_id,
        "actor_username": (actor or {}).get("username", ""),
        "actor_level": (actor or {}).get("level", ""),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "detail": json.dumps(detail or {}, ensure_ascii=False),
        "created_at": _now_iso(),
    }
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO operation_logs (
                id, actor_username, actor_level, action, target_type,
                target_id, detail, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["actor_username"],
                row["actor_level"],
                row["action"],
                row["target_type"],
                row["target_id"],
                row["detail"],
                row["created_at"],
            ),
        )
        connection.commit()
    row["detail"] = detail or {}
    return {
        "id": row["id"],
        "actorUsername": row["actor_username"],
        "actorLevel": row["actor_level"],
        "action": row["action"],
        "targetType": row["target_type"],
        "targetId": row["target_id"],
        "detail": row["detail"],
        "createdAt": row["created_at"],
    }


def list_operation_logs(limit: int = 100) -> list[dict]:
    safe_limit = max(1, min(int(limit or 100), 500))
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, actor_username, actor_level, action, target_type,
                   target_id, detail, created_at
            FROM operation_logs
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
    logs = []
    for row in rows:
        try:
            detail = json.loads(row["detail"] or "{}")
        except json.JSONDecodeError:
            detail = {}
        logs.append(
            {
                "id": row["id"],
                "actorUsername": row["actor_username"],
                "actorLevel": row["actor_level"],
                "action": row["action"],
                "targetType": row["target_type"],
                "targetId": row["target_id"],
                "detail": detail,
                "createdAt": row["created_at"],
            }
        )
    return logs


def delete_user(username: str) -> bool:
    with get_connection() as connection:
        connection.execute("DELETE FROM weeks WHERE scope_user = ?", (username,))
        deleted = connection.execute(
            "DELETE FROM users WHERE username = ?",
            (username,),
        ).rowcount
        connection.commit()
    return deleted > 0


def get_week(scope_user: str, start_date: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT payload FROM weeks WHERE scope_user = ? AND start_date = ?",
            (scope_user, start_date),
        ).fetchone()
    return json.loads(row["payload"]) if row else None


def get_week_summary(scope_user: str, start_date: str) -> dict | None:
    week = get_week(scope_user, start_date)
    if not week:
        return None

    summary = copy.deepcopy(week)
    media_found = False

    def scrub_images(image_list: list | None) -> list:
        nonlocal media_found
        values = image_list if isinstance(image_list, list) else []
        if values:
            media_found = True
        return [IMAGE_PLACEHOLDER] * len(values)

    summary.setdefault("creative", {})
    summary["creative"]["posters"] = scrub_images(summary["creative"].get("posters"))

    summary.setdefault("handover", {})
    summary["handover"]["photos"] = scrub_images(summary["handover"].get("photos"))

    daily = summary.get("daily", {})
    if isinstance(daily, dict):
        for record in daily.values():
            if not isinstance(record, dict):
                continue
            record["leaveImgs"] = scrub_images(record.get("leaveImgs"))
            record["grooming"] = scrub_images(record.get("grooming"))
            record["openingPublic"] = scrub_images(record.get("openingPublic"))
            record["openingBar"] = scrub_images(record.get("openingBar"))
            record["closingPublic"] = scrub_images(record.get("closingPublic"))
            record["closingBar"] = scrub_images(record.get("closingBar"))
            record["lossImgs"] = scrub_images(record.get("lossImgs"))
            record["inventoryImgs"] = scrub_images(record.get("inventoryImgs"))
            record["receiptImgs"] = scrub_images(record.get("receiptImgs"))

    summary["_mediaDeferred"] = media_found
    return summary


def save_week(scope_user: str, start_date: str, payload: dict) -> dict:
    normalized = normalize_payload_media(payload)
    encoded = json.dumps(normalized, ensure_ascii=False)
    with get_connection() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO weeks (scope_user, start_date, payload, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (scope_user, start_date, encoded, _now_iso()),
        )
        connection.commit()
    # Return the normalized payload so callers (API) stay consistent with persisted data.
    return normalized


def list_week_scopes(start_date: str) -> list[str]:
    """List scope_user values that have saved week payloads for the given start_date."""
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT DISTINCT scope_user FROM weeks WHERE start_date = ? ORDER BY scope_user",
            (start_date,),
        ).fetchall()
    return [row["scope_user"] for row in rows]


def list_user_week_summaries(scope_user: str) -> list[dict]:
    """List a user's saved week records without embedding media payloads."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT scope_user, start_date, updated_at
            FROM weeks
            WHERE scope_user = ?
            ORDER BY start_date DESC
            """,
            (scope_user,),
        ).fetchall()

    summaries = []
    for row in rows:
        week = get_week_summary(row["scope_user"], row["start_date"])
        if not week:
            continue
        summaries.append({
            "scopeUser": row["scope_user"],
            "startDate": row["start_date"],
            "endDate": week.get("endDate", ""),
            "teachingWeek": week.get("teachingWeek", ""),
            "members": week.get("members", {}),
            "nextGroup": week.get("nextGroup", ""),
            "daily": week.get("daily", {}),
            "updatedAt": row["updated_at"],
        })
    return summaries


def get_week_group(start_date: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT payload FROM week_groups WHERE start_date = ?",
            (start_date,),
        ).fetchone()
    return json.loads(row["payload"]) if row else None


def save_week_group(start_date: str, payload: dict) -> dict:
    encoded = json.dumps(payload, ensure_ascii=False)
    with get_connection() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO week_groups (start_date, payload, updated_at)
            VALUES (?, ?, ?)
            """,
            (start_date, encoded, _now_iso()),
        )
        connection.commit()
    return payload


def get_teacher_notice(notice_id: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, title, message, images, author_username, author_display_name,
                   created_at, updated_at
            FROM teacher_notices
            WHERE id = ?
            """,
            (notice_id,),
        ).fetchone()
        if not row:
            return None
        receipt_rows = connection.execute(
            """
            SELECT username, display_name, level, received_at
            FROM teacher_notice_receipts
            WHERE notice_id = ?
            ORDER BY received_at DESC, username
            """,
            (notice_id,),
        ).fetchall()
    return _row_to_teacher_notice(
        row,
        [_row_to_notice_receipt(receipt) for receipt in receipt_rows],
    )


def list_teacher_notices() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, message, images, author_username, author_display_name,
                   created_at, updated_at
            FROM teacher_notices
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
        notice_ids = [row["id"] for row in rows]
        receipt_map = {notice_id: [] for notice_id in notice_ids}

        if notice_ids:
            placeholders = ", ".join("?" for _ in notice_ids)
            receipt_rows = connection.execute(
                f"""
                SELECT notice_id, username, display_name, level, received_at
                FROM teacher_notice_receipts
                WHERE notice_id IN ({placeholders})
                ORDER BY received_at DESC, username
                """,
                notice_ids,
            ).fetchall()
            for row in receipt_rows:
                receipt_map.setdefault(row["notice_id"], []).append(_row_to_notice_receipt(row))

    return [_row_to_teacher_notice(row, receipt_map.get(row["id"], [])) for row in rows]


def create_teacher_notice(payload: dict) -> dict:
    notice_id = payload.get("id") or uuid4().hex
    images = [image for image in payload.get("images", []) if image]
    timestamp = _now_iso()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO teacher_notices (
                id, title, message, images, author_username,
                author_display_name, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                notice_id,
                payload.get("title", ""),
                payload.get("message", ""),
                json.dumps(images, ensure_ascii=False),
                payload.get("authorUsername", ""),
                payload.get("authorDisplayName", ""),
                payload.get("createdAt") or timestamp,
                payload.get("updatedAt") or timestamp,
            ),
        )
        connection.commit()
    return get_teacher_notice(notice_id)


def save_teacher_notice_receipts(notice_id: str, receipts: list[dict]) -> dict | None:
    if not receipts:
        return get_teacher_notice(notice_id)

    with get_connection() as connection:
        for receipt in receipts:
            connection.execute(
                """
                INSERT OR REPLACE INTO teacher_notice_receipts (
                    notice_id, username, display_name, level, received_at
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (
                    notice_id,
                    receipt.get("username", ""),
                    receipt.get("displayName", ""),
                    receipt.get("level", ""),
                    receipt.get("receivedAt") or _now_iso(),
                ),
            )
        connection.commit()
    return get_teacher_notice(notice_id)


def delete_teacher_notice(notice_id: str) -> bool:
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM teacher_notice_receipts WHERE notice_id = ?",
            (notice_id,),
        )
        deleted = connection.execute(
            "DELETE FROM teacher_notices WHERE id = ?",
            (notice_id,),
        ).rowcount
        connection.commit()
    return deleted > 0


def list_job_positions(include_inactive: bool = False) -> list[dict]:
    where = "" if include_inactive else "WHERE is_active = 1"
    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT id, name, description, is_active, sort_order,
                   created_by, created_at, updated_at
            FROM job_positions
            {where}
            ORDER BY sort_order ASC, name ASC
            """
        ).fetchall()
    return [_row_to_job_position(row) for row in rows]


def get_job_position(position_id: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, name, description, is_active, sort_order,
                   created_by, created_at, updated_at
            FROM job_positions
            WHERE id = ?
            """,
            (position_id,),
        ).fetchone()
    return _row_to_job_position(row) if row else None


def create_job_position(payload: dict, actor: dict) -> dict:
    timestamp = _now_iso()
    position_id = uuid4().hex
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO job_positions (
                id, name, description, is_active, sort_order,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                position_id,
                payload.get("name", ""),
                payload.get("description", ""),
                1 if payload.get("isActive", True) else 0,
                int(payload.get("sortOrder") or 0),
                actor.get("username", ""),
                timestamp,
                timestamp,
            ),
        )
        connection.commit()
    return get_job_position(position_id)


def update_job_position(position_id: str, payload: dict) -> dict | None:
    existing = get_job_position(position_id)
    if not existing:
        return None
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE job_positions
            SET name = ?, description = ?, is_active = ?, sort_order = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                payload.get("name", existing.get("name", "")),
                payload.get("description", existing.get("description", "")),
                1 if payload.get("isActive", existing.get("isActive", True)) else 0,
                int(payload.get("sortOrder", existing.get("sortOrder") or 0) or 0),
                _now_iso(),
                position_id,
            ),
        )
        connection.commit()
    return get_job_position(position_id)


def list_job_assignments(work_date: str | None = None, student_username: str | None = None) -> list[dict]:
    clauses = []
    params: list[str] = []
    if work_date:
        clauses.append("work_date = ?")
        params.append(work_date)
    if student_username:
        clauses.append("student_username = ?")
        params.append(student_username)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT id, student_username, student_name, work_date, slot_start, slot_end,
                   position_id, position_name, assigned_by, assigned_by_name,
                   note, created_at, updated_at
            FROM job_assignments
            {where}
            ORDER BY work_date DESC, slot_start ASC, student_name ASC, student_username ASC
            """,
            params,
        ).fetchall()
    return [_row_to_job_assignment(row) for row in rows]


def get_job_assignment(assignment_id: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, student_username, student_name, work_date, slot_start, slot_end,
                   position_id, position_name, assigned_by, assigned_by_name,
                   note, created_at, updated_at
            FROM job_assignments
            WHERE id = ?
            """,
            (assignment_id,),
        ).fetchone()
    return _row_to_job_assignment(row) if row else None


def upsert_job_assignment(payload: dict, actor: dict, student: dict, position: dict) -> dict:
    timestamp = _now_iso()
    existing = None
    with get_connection() as connection:
        existing = connection.execute(
            """
            SELECT id, created_at FROM job_assignments
            WHERE student_username = ? AND work_date = ? AND slot_start = ?
            """,
            (payload["studentUsername"], payload["workDate"], payload["slotStart"]),
        ).fetchone()
        assignment_id = existing["id"] if existing else uuid4().hex
        created_at = existing["created_at"] if existing else timestamp
        connection.execute(
            """
            INSERT OR REPLACE INTO job_assignments (
                id, student_username, student_name, work_date, slot_start, slot_end,
                position_id, position_name, assigned_by, assigned_by_name,
                note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                assignment_id,
                payload["studentUsername"],
                student.get("displayName") or student.get("username", ""),
                payload["workDate"],
                payload["slotStart"],
                payload["slotEnd"],
                position["id"],
                position["name"],
                actor.get("username", ""),
                actor.get("displayName") or actor.get("username", ""),
                payload.get("note", ""),
                created_at,
                timestamp,
            ),
        )
        connection.commit()
    return get_job_assignment(assignment_id)


def delete_job_assignment(assignment_id: str) -> bool:
    with get_connection() as connection:
        deleted = connection.execute(
            "DELETE FROM job_assignments WHERE id = ?",
            (assignment_id,),
        ).rowcount
        connection.commit()
    return deleted > 0
