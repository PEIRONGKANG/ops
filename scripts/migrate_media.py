#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path


def main() -> int:
    # Import from the backend package in this repo.
    repo_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(repo_root))
    from backend.app.database import MEDIA_DIR, normalize_payload_media  # noqa: E402

    db_path = Path(os.environ.get("OPS_TRAINING_DB_PATH", repo_root / "backend" / "data" / "ops_training.db"))
    if not db_path.exists():
        raise SystemExit(f"DB not found: {db_path}")

    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"DB={db_path}")
    print(f"MEDIA_DIR={MEDIA_DIR}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    changed_weeks = 0
    changed_notices = 0

    def has_data_urls(obj: object) -> bool:
        if isinstance(obj, str):
            return obj.startswith("data:")
        if isinstance(obj, list):
            return any(has_data_urls(v) for v in obj)
        if isinstance(obj, dict):
            return any(has_data_urls(v) for v in obj.values())
        return False

    with conn:
        rows = conn.execute("SELECT scope_user, start_date, payload FROM weeks").fetchall()
        for row in rows:
            raw = row["payload"]
            try:
                payload = json.loads(raw)
            except Exception:
                continue
            if not has_data_urls(payload):
                continue
            normalized = normalize_payload_media(payload)
            if has_data_urls(normalized):
                # If still contains data URLs, skip update (decode failure, etc.)
                continue
            conn.execute(
                "UPDATE weeks SET payload = ? WHERE scope_user = ? AND start_date = ?",
                (json.dumps(normalized, ensure_ascii=False), row["scope_user"], row["start_date"]),
            )
            changed_weeks += 1

        if (conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='teacher_notices'").fetchone()):
            notice_rows = conn.execute("SELECT id, images FROM teacher_notices").fetchall()
            for row in notice_rows:
                images_raw = row["images"] or "[]"
                try:
                    images = json.loads(images_raw)
                except Exception:
                    continue
                if not has_data_urls(images):
                    continue
                normalized = normalize_payload_media(images)
                if has_data_urls(normalized):
                    continue
                conn.execute(
                    "UPDATE teacher_notices SET images = ? WHERE id = ?",
                    (json.dumps(normalized, ensure_ascii=False), row["id"]),
                )
                changed_notices += 1

    conn.close()
    print(f"changed_weeks={changed_weeks}")
    print(f"changed_teacher_notices={changed_notices}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

