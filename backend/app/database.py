import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


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
    connection.execute("PRAGMA foreign_keys = ON")
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


def _row_to_term(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "code": row["code"],
        "name": row["name"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_class_item(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "code": row["code"],
        "name": row["name"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_course_batch(row: sqlite3.Row) -> dict:
    class_ids = row["class_ids"].split(",") if row["class_ids"] else []
    return {
        "id": row["id"],
        "name": row["name"],
        "courseName": row["course_name"],
        "termId": row["term_id"],
        "termName": row["term_name"],
        "classIds": [int(value) for value in class_ids if value],
        "classNames": row["class_names"].split("、") if row["class_names"] else [],
        "startWeek": row["start_week"],
        "endWeek": row["end_week"],
        "exportTemplateVersion": row["export_template_version"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_group(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "batchId": row["batch_id"],
        "batchName": row["batch_name"],
        "name": row["name"],
        "sequence": row["sequence"],
        "handoverGroupId": row["handover_group_id"],
        "handoverGroupName": row["handover_group_name"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_group_member(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "groupId": row["group_id"],
        "groupName": row["group_name"],
        "studentUsername": row["student_username"],
        "studentName": row["student_name"],
        "createdAt": row["created_at"],
    }


def _row_to_schedule_assignment(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "batchId": row["batch_id"],
        "batchName": row["batch_name"],
        "teachingWeek": row["teaching_week"],
        "weekStartDate": row["week_start_date"],
        "primaryGroupId": row["primary_group_id"],
        "primaryGroupName": row["primary_group_name"],
        "secondaryGroupId": row["secondary_group_id"],
        "secondaryGroupName": row["secondary_group_name"],
        "notes": row["notes"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_resource(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "description": row["description"],
        "fileName": row["file_name"],
        "fileData": row["file_data"],
        "externalUrl": row["external_url"],
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _seed_foundation(connection: sqlite3.Connection) -> None:
    term_row = connection.execute("SELECT id FROM terms ORDER BY id LIMIT 1").fetchone()
    if term_row:
        default_term_id = term_row["id"]
    else:
        connection.execute(
            """
            INSERT INTO terms (code, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            ("TERM-DEFAULT", "默认学期", _now_iso(), _now_iso()),
        )
        default_term_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]

    class_row = connection.execute("SELECT id FROM classes ORDER BY id LIMIT 1").fetchone()
    if class_row:
        default_class_id = class_row["id"]
    else:
        connection.execute(
            """
            INSERT INTO classes (code, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            ("CLASS-DEFAULT", "默认班级", _now_iso(), _now_iso()),
        )
        default_class_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]

    batch_row = connection.execute("SELECT id FROM course_batches ORDER BY id LIMIT 1").fetchone()
    if batch_row:
        default_batch_id = batch_row["id"]
    else:
        connection.execute(
            """
            INSERT INTO course_batches (
                name, course_name, term_id, start_week, end_week,
                export_template_version, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "默认课程批次",
                "门店创意饮品策划与运营实践",
                default_term_id,
                1,
                18,
                "v1",
                _now_iso(),
                _now_iso(),
            ),
        )
        default_batch_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]

    link_exists = connection.execute(
        """
        SELECT 1
        FROM course_batch_classes
        WHERE batch_id = ? AND class_id = ?
        """,
        (default_batch_id, default_class_id),
    ).fetchone()
    if not link_exists:
        connection.execute(
            "INSERT INTO course_batch_classes (batch_id, class_id) VALUES (?, ?)",
            (default_batch_id, default_class_id),
        )

    group_count = connection.execute(
        "SELECT COUNT(*) AS count FROM groups WHERE batch_id = ?",
        (default_batch_id,),
    ).fetchone()["count"]
    if not group_count:
        group_ids = []
        for index in range(1, 15):
            connection.execute(
                """
                INSERT INTO groups (batch_id, name, sequence, handover_group_id, created_at, updated_at)
                VALUES (?, ?, ?, NULL, ?, ?)
                """,
                (default_batch_id, f"第{index}组", index, _now_iso(), _now_iso()),
            )
            group_ids.append(connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
        for index, group_id in enumerate(group_ids):
            handover_group_id = group_ids[(index + 1) % len(group_ids)]
            connection.execute(
                "UPDATE groups SET handover_group_id = ?, updated_at = ? WHERE id = ?",
                (handover_group_id, _now_iso(), group_id),
            )


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

            CREATE TABLE IF NOT EXISTS terms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS course_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                course_name TEXT NOT NULL,
                term_id INTEGER REFERENCES terms(id) ON DELETE SET NULL,
                start_week INTEGER NOT NULL DEFAULT 1,
                end_week INTEGER NOT NULL DEFAULT 18,
                export_template_version TEXT NOT NULL DEFAULT 'v1',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS course_batch_classes (
                batch_id INTEGER NOT NULL REFERENCES course_batches(id) ON DELETE CASCADE,
                class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                PRIMARY KEY (batch_id, class_id)
            );

            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER NOT NULL REFERENCES course_batches(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                handover_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE (batch_id, name),
                UNIQUE (batch_id, sequence)
            );

            CREATE TABLE IF NOT EXISTS group_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                student_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                UNIQUE (group_id, student_username)
            );

            CREATE TABLE IF NOT EXISTS schedule_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER NOT NULL REFERENCES course_batches(id) ON DELETE CASCADE,
                teaching_week TEXT NOT NULL,
                week_start_date TEXT NOT NULL DEFAULT '',
                primary_group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                secondary_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                file_name TEXT NOT NULL DEFAULT '',
                file_data TEXT NOT NULL DEFAULT '',
                external_url TEXT NOT NULL DEFAULT '',
                created_by TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
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
        _seed_foundation(connection)
        connection.commit()


def list_users() -> List[Dict[str, Any]]:
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


def get_user(username: str) -> Optional[Dict[str, Any]]:
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


def verify_user(username: str, password: str) -> Optional[Dict[str, Any]]:
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


def get_week(scope_user: str, start_date: str) -> Optional[Dict[str, Any]]:
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


def get_week_group(start_date: str) -> Optional[Dict[str, Any]]:
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


def list_terms() -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, code, name, created_at, updated_at
            FROM terms
            ORDER BY id DESC
            """
        ).fetchall()
    return [_row_to_term(row) for row in rows]


def create_term(payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO terms (code, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (payload["code"], payload["name"], _now_iso(), _now_iso()),
        )
        term_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        connection.commit()
    return get_term(term_id)


def get_term(term_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, code, name, created_at, updated_at FROM terms WHERE id = ?",
            (term_id,),
        ).fetchone()
    return _row_to_term(row) if row else None


def delete_term(term_id: int) -> bool:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM terms WHERE id = ?", (term_id,)).rowcount
        connection.commit()
    return deleted > 0


def list_classes() -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, code, name, created_at, updated_at
            FROM classes
            ORDER BY id DESC
            """
        ).fetchall()
    return [_row_to_class_item(row) for row in rows]


def create_class_item(payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO classes (code, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (payload["code"], payload["name"], _now_iso(), _now_iso()),
        )
        class_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        connection.commit()
    return get_class_item(class_id)


def get_class_item(class_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, code, name, created_at, updated_at FROM classes WHERE id = ?",
            (class_id,),
        ).fetchone()
    return _row_to_class_item(row) if row else None


def delete_class_item(class_id: int) -> bool:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM classes WHERE id = ?", (class_id,)).rowcount
        connection.commit()
    return deleted > 0


def list_course_batches() -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                b.id,
                b.name,
                b.course_name,
                b.term_id,
                t.name AS term_name,
                b.start_week,
                b.end_week,
                b.export_template_version,
                b.created_at,
                b.updated_at,
                GROUP_CONCAT(c.id) AS class_ids,
                GROUP_CONCAT(c.name, '、') AS class_names
            FROM course_batches b
            LEFT JOIN terms t ON t.id = b.term_id
            LEFT JOIN course_batch_classes bc ON bc.batch_id = b.id
            LEFT JOIN classes c ON c.id = bc.class_id
            GROUP BY b.id
            ORDER BY b.id DESC
            """
        ).fetchall()
    return [_row_to_course_batch(row) for row in rows]


def get_course_batch(batch_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                b.id,
                b.name,
                b.course_name,
                b.term_id,
                t.name AS term_name,
                b.start_week,
                b.end_week,
                b.export_template_version,
                b.created_at,
                b.updated_at,
                GROUP_CONCAT(c.id) AS class_ids,
                GROUP_CONCAT(c.name, '、') AS class_names
            FROM course_batches b
            LEFT JOIN terms t ON t.id = b.term_id
            LEFT JOIN course_batch_classes bc ON bc.batch_id = b.id
            LEFT JOIN classes c ON c.id = bc.class_id
            WHERE b.id = ?
            GROUP BY b.id
            """,
            (batch_id,),
        ).fetchone()
    return _row_to_course_batch(row) if row else None


def create_course_batch(payload: dict) -> dict:
    class_ids = payload.get("classIds", [])
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO course_batches (
                name, course_name, term_id, start_week, end_week,
                export_template_version, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["name"],
                payload["courseName"],
                payload.get("termId"),
                payload.get("startWeek", 1),
                payload.get("endWeek", 18),
                payload.get("exportTemplateVersion", "v1"),
                _now_iso(),
                _now_iso(),
            ),
        )
        batch_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        for class_id in class_ids:
            connection.execute(
                "INSERT INTO course_batch_classes (batch_id, class_id) VALUES (?, ?)",
                (batch_id, class_id),
            )
        connection.commit()
    return get_course_batch(batch_id)


def delete_course_batch(batch_id: int) -> bool:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM course_batches WHERE id = ?", (batch_id,)).rowcount
        connection.commit()
    return deleted > 0


def list_groups() -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                g.id,
                g.batch_id,
                b.name AS batch_name,
                g.name,
                g.sequence,
                g.handover_group_id,
                hg.name AS handover_group_name,
                g.created_at,
                g.updated_at
            FROM groups g
            JOIN course_batches b ON b.id = g.batch_id
            LEFT JOIN groups hg ON hg.id = g.handover_group_id
            ORDER BY g.batch_id, g.sequence
            """
        ).fetchall()
    return [_row_to_group(row) for row in rows]


def get_group(group_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                g.id,
                g.batch_id,
                b.name AS batch_name,
                g.name,
                g.sequence,
                g.handover_group_id,
                hg.name AS handover_group_name,
                g.created_at,
                g.updated_at
            FROM groups g
            JOIN course_batches b ON b.id = g.batch_id
            LEFT JOIN groups hg ON hg.id = g.handover_group_id
            WHERE g.id = ?
            """,
            (group_id,),
        ).fetchone()
    return _row_to_group(row) if row else None


def create_group(payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO groups (
                batch_id, name, sequence, handover_group_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload["batchId"],
                payload["name"],
                payload["sequence"],
                payload.get("handoverGroupId"),
                _now_iso(),
                _now_iso(),
            ),
        )
        group_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        connection.commit()
    return get_group(group_id)


def delete_group(group_id: int) -> bool:
    with get_connection() as connection:
        connection.execute(
            "UPDATE groups SET handover_group_id = NULL, updated_at = ? WHERE handover_group_id = ?",
            (_now_iso(), group_id),
        )
        deleted = connection.execute("DELETE FROM groups WHERE id = ?", (group_id,)).rowcount
        connection.commit()
    return deleted > 0


def list_group_members() -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                gm.id,
                gm.group_id,
                g.name AS group_name,
                gm.student_username,
                u.display_name AS student_name,
                gm.created_at
            FROM group_members gm
            JOIN groups g ON g.id = gm.group_id
            JOIN users u ON u.username = gm.student_username
            ORDER BY gm.group_id, gm.id
            """
        ).fetchall()
    return [_row_to_group_member(row) for row in rows]


def create_group_member(payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO group_members (group_id, student_username, created_at)
            VALUES (?, ?, ?)
            """,
            (payload["groupId"], payload["studentUsername"], _now_iso()),
        )
        member_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        connection.commit()
    return get_group_member(member_id)


def get_group_member(member_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                gm.id,
                gm.group_id,
                g.name AS group_name,
                gm.student_username,
                u.display_name AS student_name,
                gm.created_at
            FROM group_members gm
            JOIN groups g ON g.id = gm.group_id
            JOIN users u ON u.username = gm.student_username
            WHERE gm.id = ?
            """,
            (member_id,),
        ).fetchone()
    return _row_to_group_member(row) if row else None


def delete_group_member(member_id: int) -> bool:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM group_members WHERE id = ?", (member_id,)).rowcount
        connection.commit()
    return deleted > 0


def list_schedule_assignments() -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                sa.id,
                sa.batch_id,
                b.name AS batch_name,
                sa.teaching_week,
                sa.week_start_date,
                sa.primary_group_id,
                pg.name AS primary_group_name,
                sa.secondary_group_id,
                sg.name AS secondary_group_name,
                sa.notes,
                sa.created_at,
                sa.updated_at
            FROM schedule_assignments sa
            JOIN course_batches b ON b.id = sa.batch_id
            JOIN groups pg ON pg.id = sa.primary_group_id
            LEFT JOIN groups sg ON sg.id = sa.secondary_group_id
            ORDER BY sa.week_start_date DESC, sa.teaching_week DESC, sa.id DESC
            """
        ).fetchall()
    return [_row_to_schedule_assignment(row) for row in rows]


def get_schedule_assignment(assignment_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                sa.id,
                sa.batch_id,
                b.name AS batch_name,
                sa.teaching_week,
                sa.week_start_date,
                sa.primary_group_id,
                pg.name AS primary_group_name,
                sa.secondary_group_id,
                sg.name AS secondary_group_name,
                sa.notes,
                sa.created_at,
                sa.updated_at
            FROM schedule_assignments sa
            JOIN course_batches b ON b.id = sa.batch_id
            JOIN groups pg ON pg.id = sa.primary_group_id
            LEFT JOIN groups sg ON sg.id = sa.secondary_group_id
            WHERE sa.id = ?
            """,
            (assignment_id,),
        ).fetchone()
    return _row_to_schedule_assignment(row) if row else None


def create_schedule_assignment(payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO schedule_assignments (
                batch_id, teaching_week, week_start_date,
                primary_group_id, secondary_group_id, notes,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["batchId"],
                payload["teachingWeek"],
                payload.get("weekStartDate", ""),
                payload["primaryGroupId"],
                payload.get("secondaryGroupId"),
                payload.get("notes", ""),
                _now_iso(),
                _now_iso(),
            ),
        )
        assignment_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        connection.commit()
    return get_schedule_assignment(assignment_id)


def delete_schedule_assignment(assignment_id: int) -> bool:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM schedule_assignments WHERE id = ?", (assignment_id,)).rowcount
        connection.commit()
    return deleted > 0


def list_resources() -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                id, title, category, description, file_name, file_data,
                external_url, created_by, created_at, updated_at
            FROM resources
            ORDER BY id DESC
            """
        ).fetchall()
    return [_row_to_resource(row) for row in rows]


def get_resource(resource_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id, title, category, description, file_name, file_data,
                external_url, created_by, created_at, updated_at
            FROM resources
            WHERE id = ?
            """,
            (resource_id,),
        ).fetchone()
    return _row_to_resource(row) if row else None


def create_resource(payload: dict) -> dict:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO resources (
                title, category, description, file_name, file_data,
                external_url, created_by, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["title"],
                payload["category"],
                payload.get("description", ""),
                payload.get("fileName", ""),
                payload.get("fileData", ""),
                payload.get("externalUrl", ""),
                payload.get("createdBy", ""),
                _now_iso(),
                _now_iso(),
            ),
        )
        resource_id = connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        connection.commit()
    return get_resource(resource_id)


def delete_resource(resource_id: int) -> bool:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM resources WHERE id = ?", (resource_id,)).rowcount
        connection.commit()
    return deleted > 0


def get_foundation_bootstrap() -> dict:
    return {
        "terms": list_terms(),
        "classes": list_classes(),
        "courseBatches": list_course_batches(),
        "groups": list_groups(),
        "groupMembers": list_group_members(),
        "scheduleAssignments": list_schedule_assignments(),
        "resources": list_resources(),
    }
