import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "backend" / "data"
DB_PATH = Path(os.environ.get("OPS_TRAINING_DB_PATH", DATA_DIR / "ops_training.db"))


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
                name_updated_at TEXT NOT NULL DEFAULT ''
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
            """
        )

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
                    owner_type, password_updated_at, name_updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, '', '')
                """,
                (
                    user["username"],
                    user["password"],
                    user["role"],
                    user["level"],
                    user["display_name"],
                    user["owner_type"],
                ),
            )
        connection.commit()


def list_users() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT username, password, role, level, display_name,
                   owner_type, password_updated_at, name_updated_at
            FROM users
            ORDER BY username
            """
        ).fetchall()
    return [_row_to_user(row) for row in rows]


def get_user(username: str) -> dict | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT username, password, role, level, display_name,
                   owner_type, password_updated_at, name_updated_at
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
                   owner_type, password_updated_at, name_updated_at
            FROM users
            WHERE username = ? AND password = ?
            """,
            (username, password),
        ).fetchone()
    return _row_to_user(row) if row else None


def create_user(payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO users (
                username, password, role, level, display_name,
                owner_type, password_updated_at, name_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["username"],
                payload["password"],
                payload["role"],
                payload["level"],
                payload["displayName"],
                payload.get("ownerType", ""),
                payload.get("passwordUpdatedAt", ""),
                payload.get("nameUpdatedAt", ""),
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
                name_updated_at = ?
            WHERE username = ?
            """,
            (
                payload["password"],
                payload["role"],
                payload["level"],
                payload["displayName"],
                payload.get("ownerType", ""),
                payload.get("passwordUpdatedAt", ""),
                payload.get("nameUpdatedAt", ""),
                username,
            ),
        )
        connection.commit()
    return get_user(username)


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


def save_week(scope_user: str, start_date: str, payload: dict) -> dict:
    encoded = json.dumps(payload, ensure_ascii=False)
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO weeks (scope_user, start_date, payload, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(scope_user, start_date)
            DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
            """,
            (scope_user, start_date, encoded, _now_iso()),
        )
        connection.commit()
    return payload


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
            INSERT INTO week_groups (start_date, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(start_date)
            DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
            """,
            (start_date, encoded, _now_iso()),
        )
        connection.commit()
    return payload
