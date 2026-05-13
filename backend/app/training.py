from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from .pocketbase_client import get_pocketbase_client


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _trim(value: Any) -> str:
    return str(value or "").strip()


def _grade(exercise: dict, submitted: Any) -> dict:
    ex_type = _trim(exercise.get("type"))
    answer = exercise.get("answer")
    score_value = int(exercise.get("score") or 0)
    explanation = _trim(exercise.get("explanation"))

    def result(is_correct: bool, feedback: str) -> dict:
        return {
            "isCorrect": bool(is_correct),
            "score": score_value if is_correct else 0,
            "feedback": feedback,
            "explanation": explanation,
        }

    if ex_type in {"single_choice", "multiple_choice"}:
        submitted_arr = submitted if isinstance(submitted, list) else [submitted] if submitted is not None else []
        submitted_norm = sorted([_trim(x) for x in submitted_arr if _trim(x)])
        answer_arr = answer if isinstance(answer, list) else [answer] if answer is not None else []
        answer_norm = sorted([_trim(x) for x in answer_arr if _trim(x)])
        return result(submitted_norm == answer_norm, "回答正确" if submitted_norm == answer_norm else "回答不正确")

    if ex_type in {"text_input", "short_answer"}:
        submitted_text = _trim(submitted).lower()
        keywords = exercise.get("keywords")
        if isinstance(keywords, list) and keywords:
            normalized_keywords = [_trim(item).lower() for item in keywords if _trim(item)]
            matched = bool(normalized_keywords) and all(keyword in submitted_text for keyword in normalized_keywords)
            return result(matched, "回答正确" if matched else "回答不完整，请补充关键表达")
        answer_text = _trim(answer).lower()
        return result(submitted_text == answer_text and bool(answer_text), "回答正确" if submitted_text == answer_text else "回答不正确")

    return result(False, "暂不支持的题型")


async def _pb_list_all(pb, collection: str, *, filter_expr: str = "", sort: str = "", expand: str = "") -> list[dict]:
    items: list[dict] = []
    page = 1
    while True:
        params = {"page": page, "perPage": 200}
        if filter_expr:
            params["filter"] = filter_expr
        if sort:
            params["sort"] = sort
        if expand:
            params["expand"] = expand
        data = await pb.request("GET", f"/api/collections/{collection}/records", params=params)
        page_items = list(data.get("items") or [])
        items.extend(page_items)
        total_pages = int(data.get("totalPages") or 1)
        if page >= total_pages:
            break
        page += 1
    return items


async def _pb_first(pb, collection: str, *, filter_expr: str) -> dict | None:
    data = await pb.request(
        "GET",
        f"/api/collections/{collection}/records",
        params={"page": 1, "perPage": 1, "filter": filter_expr},
    )
    items = data.get("items") or []
    return items[0] if items else None


async def _ensure_student_record(pb, current_user: dict) -> dict:
    student_no = _trim(current_user.get("username"))
    display_name = _trim(current_user.get("displayName")) or student_no
    role_code = _trim(current_user.get("level")) or "P3"

    record = await _pb_first(pb, "Students", filter_expr=f'student_no=\"{student_no}\"')
    if record:
        return record

    payload = {
        "name": display_name,
        "student_no": student_no,
        "class_name": "",
        "group_name": "",
        "role_code": role_code,
        "training_progress": 0,
        "current_status": "not_started",
        "last_login_at": _now_iso(),
    }
    created = await pb.request("POST", "/api/collections/Students/records", json_body=payload)
    return created


def build_router(require_current_user):
    pb = get_pocketbase_client()
    r = APIRouter(prefix="/api/training", tags=["training"])

    @r.get("/tasks")
    async def list_tasks(published_only: bool = True, current_user: dict = Depends(require_current_user)) -> dict:
        level = _trim(current_user.get("level"))
        if level in {"P1", "T1", "P2"}:
            published_only = False if published_only is False else True
        filter_expr = 'status=\"published\"' if published_only else ""
        # PocketBase v0.38 returns 400 when sorting by system fields like `created`/`updated`.
        tasks = await _pb_list_all(pb, "Training_Tasks", filter_expr=filter_expr, sort="sort_order,task_name")
        return {"tasks": tasks}

    @r.post("/tasks")
    async def create_task(payload: dict, current_user: dict = Depends(require_current_user)) -> dict:
        level = _trim(current_user.get("level"))
        if level not in {"P1", "T1"}:
            raise HTTPException(status_code=403, detail="权限不足。")
        created = await pb.request("POST", "/api/collections/Training_Tasks/records", json_body=payload)
        return {"task": created}

    @r.patch("/tasks/{task_id}")
    async def update_task(task_id: str, payload: dict, current_user: dict = Depends(require_current_user)) -> dict:
        level = _trim(current_user.get("level"))
        if level not in {"P1", "T1"}:
            raise HTTPException(status_code=403, detail="权限不足。")
        updated = await pb.request("PATCH", f"/api/collections/Training_Tasks/records/{task_id}", json_body=payload)
        return {"task": updated}

    @r.get("/my/submissions")
    async def my_submissions(current_user: dict = Depends(require_current_user)) -> dict:
        student = await _ensure_student_record(pb, current_user)
        submissions = await _pb_list_all(
            pb,
            "Submissions",
            filter_expr=f'student_id="{student["id"]}"',
            sort="-submitted_at",
            expand="task_id,student_id,reviewed_by",
        )
        return {"submissions": submissions, "student": student}

    @r.post("/submit")
    async def submit(payload: dict, current_user: dict = Depends(require_current_user)) -> dict:
        level = _trim(current_user.get("level"))
        if level != "P3":
            raise HTTPException(status_code=403, detail="仅学生账号可提交。")

        task_id = _trim(payload.get("task_id"))
        submitted_answer = payload.get("submitted_answer")
        if not task_id:
            raise HTTPException(status_code=400, detail="缺少 task_id。")

        task = await pb.request("GET", f"/api/collections/Training_Tasks/records/{task_id}")
        exercise = task.get("interactive_exercise") or {}
        if not isinstance(exercise, dict):
            exercise = {}
        graded = _grade(exercise, submitted_answer)

        student = await _ensure_student_record(pb, current_user)

        existing = await _pb_first(pb, "Submissions", filter_expr=f'student_id="{student["id"]}" && task_id="{task_id}"')
        record_payload = {
            "student_id": student["id"],
            "task_id": task_id,
            "submitted_answer": submitted_answer,
            "score": graded["score"],
            "is_correct": bool(graded["isCorrect"]),
            "feedback": graded["feedback"],
            "status": "completed" if graded["isCorrect"] else "submitted",
            "submitted_at": _now_iso(),
            "reviewed_by": "",
            "reviewed_at": "",
            "teacher_comment": "",
        }

        if existing:
            submission = await pb.request("PATCH", f"/api/collections/Submissions/records/{existing['id']}", json_body=record_payload)
        else:
            submission = await pb.request("POST", "/api/collections/Submissions/records", json_body=record_payload)

        # Progress update (published tasks only).
        tasks = await _pb_list_all(pb, "Training_Tasks", filter_expr='status=\"published\"', sort="sort_order,task_name")
        if tasks:
            completed = await _pb_list_all(
                pb,
                "Submissions",
                filter_expr=f'student_id="{student["id"]}" && status="completed"',
                sort="-submitted_at",
            )
            progress = int(round((len(completed) / len(tasks)) * 100))
            await pb.request("PATCH", f"/api/collections/Students/records/{student['id']}", json_body={"training_progress": progress, "current_status": "in_progress" if progress < 100 else "completed"})

        return {"submission": submission, "graded": graded}

    @r.get("/progress")
    async def progress_overview(current_user: dict = Depends(require_current_user)) -> dict:
        level = _trim(current_user.get("level"))
        if level not in {"P1", "T1", "P2"}:
            raise HTTPException(status_code=403, detail="权限不足。")

        tasks = await _pb_list_all(pb, "Training_Tasks", filter_expr='status=\"published\"', sort="sort_order,task_name")
        students = await _pb_list_all(pb, "Students", sort="student_no")
        submissions = await _pb_list_all(pb, "Submissions", sort="-submitted_at", expand="task_id,student_id")

        return {"tasks": tasks, "students": students, "submissions": submissions}

    return r
