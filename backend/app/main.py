from __future__ import annotations

import os
from typing import Annotated
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import (
    create_user,
    create_teacher_notice,
    create_session,
    delete_user,
    delete_teacher_notice,
    delete_session,
    create_operation_log,
    get_user,
    get_teacher_notice,
    get_session,
    get_week,
    get_week_summary,
    get_week_group,
    init_db,
    list_week_scopes,
    list_users,
    list_users_for_client,
    list_operation_logs,
    list_teacher_notices,
    MEDIA_DIR,
    save_week,
    save_week_group,
    save_teacher_notice_receipts,
    update_user,
    verify_user,
)
from .password_crypto import verify_password_view_passphrase
from .schemas import (
    LoginRequest,
    TeacherNoticePayload,
    TeacherNoticeReceiptPayload,
    UserPayload,
    WeekGroupPayload,
    WeekPayload,
)
from .training import build_router
from .pocketbase_client import get_pocketbase_client


ROOT_DIR = Path(__file__).resolve().parents[2]
DIST_DIR = ROOT_DIR / "frontend" / "dist"
TRAINING_DIST_DIR = ROOT_DIR / "training_frontend" / "dist"

MAX_WEEK_START_FUTURE_DAYS = 180
ACCOUNT_SENSITIVE_FIELDS = {
    "role",
    "level",
    "role_code",
    "roleCode",
    "permission",
    "permission_scope",
    "permissionScope",
    "is_admin",
    "isAdmin",
    "is_active",
    "isActive",
    "group_id",
    "groupId",
    "class_id",
    "classId",
    "managed_scope",
    "managedScope",
    "ownerType",
}
ACCOUNT_SELF_UPDATE_FIELDS = {"password", "displayName", "passwordUpdatedAt", "nameUpdatedAt"}
LEVEL_TO_ROLE = {"P1": "admin", "T1": "supervisor", "P2": "manager", "P3": "student"}


def normalize_week_start(start_date: str) -> str:
    """Normalize an arbitrary date to the week's canonical start (Wednesday)."""
    try:
        parsed = date.fromisoformat(start_date)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="周次日期格式不正确，应为 YYYY-MM-DD。") from exc

    # Python weekday: Monday=0 ... Sunday=6. Wednesday=2.
    diff = (parsed.weekday() - 2) % 7
    corrected = parsed - timedelta(days=diff)

    if (corrected - date.today()).days > MAX_WEEK_START_FUTURE_DAYS:
        raise HTTPException(status_code=400, detail="周次日期异常（超过允许的未来范围）。")

    return corrected.isoformat()


app = FastAPI(title="Drink Training Ops API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

POCKETBASE_INTERNAL_URL = os.environ.get("OPS_POCKETBASE_INTERNAL_URL", "http://127.0.0.1:8090")


def require_current_user(authorization: Annotated[str | None, Header()] = None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录。")
    token = authorization.split(" ", 1)[1].strip()
    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录。")
    user = get_user(session["username"])
    if not user:
        delete_session(token)
        raise HTTPException(status_code=401, detail="账号不存在，请重新登录。")
    # Never expose the password field to clients.
    safe = {**user}
    safe.pop("password", None)
    safe["sessionToken"] = token
    return safe


def _safe_user(user: dict | None) -> dict:
    safe = {**(user or {})}
    safe.pop("password", None)
    return safe


def _merge_account_payload(existing: dict, payload: dict) -> dict:
    merged = {**existing}
    for key, value in payload.items():
        if key in {"username", "createdAt", "lastLoginAt"}:
            continue
        if key == "password" and value == "":
            continue
        merged[key] = value
    if "level" in payload and "role" not in payload:
        merged["role"] = LEVEL_TO_ROLE.get(payload.get("level"), merged.get("role", "student"))
    if "is_active" in payload and "isActive" not in payload:
        merged["isActive"] = bool(payload.get("is_active"))
    if "role_code" in payload and "level" not in payload:
        merged["level"] = payload.get("role_code") or existing.get("level")
        merged["role"] = LEVEL_TO_ROLE.get(merged.get("level"), merged.get("role", "student"))
    return merged


async def _pb_list_all(collection: str, *, filter_expr: str = "", sort: str = "", expand: str = "") -> list[dict]:
    pb = get_pocketbase_client()
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


async def _pb_first(collection: str, *, filter_expr: str) -> dict | None:
    pb = get_pocketbase_client()
    data = await pb.request(
        "GET",
        f"/api/collections/{collection}/records",
        params={"page": 1, "perPage": 1, "filter": filter_expr},
    )
    items = data.get("items") or []
    return items[0] if items else None


def _semester_display_name(payload: dict) -> str:
    start = int(payload.get("academic_year_start") or 2025)
    end = int(payload.get("academic_year_end") or start + 1)
    number = payload.get("semester_number") or "第二学期"
    season = payload.get("season") or "春季学期"
    return f"{start}-{end} 学年 {number}（{season}）"


def _date_for_pb(value: date) -> str:
    return datetime.combine(value, datetime.min.time()).astimezone().isoformat(timespec="seconds")


def _parse_date_like(value: str) -> datetime | None:
    if not value:
        return None
    raw = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw)
    except Exception:
        try:
            return datetime.fromisoformat(raw[:19])
        except Exception:
            return None


# Training APIs (PocketBase-backed, unified with Ops login token).
try:
    app.include_router(build_router(require_current_user))
except Exception as exc:
    # Keep legacy Ops endpoints available even if PocketBase isn't configured.
    print(f"[training] router disabled: {exc}")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}

@app.get("/api/now")
def now() -> dict:
    """Server-side time for clients that need a trusted clock (e.g. P3 check-in)."""
    current = datetime.now().astimezone()
    return {
        "iso": current.isoformat(timespec="seconds"),
        "epochMs": int(current.timestamp() * 1000),
        "time": current.strftime("%H:%M:%S"),
        "timezone": str(current.tzinfo),
    }

@app.api_route("/pb/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], include_in_schema=False)
async def pocketbase_proxy(full_path: str, request: Request):
    """Reverse proxy PocketBase so the training frontend can use a same-origin base URL (/pb)."""
    upstream = POCKETBASE_INTERNAL_URL.rstrip("/")
    target = f"{upstream}/{full_path}"
    if request.url.query:
        target = f"{target}?{request.url.query}"

    headers = dict(request.headers)
    headers.pop("host", None)

    try:
        body = await request.body()
        timeout = httpx.Timeout(180.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            upstream_resp = await client.request(request.method, target, headers=headers, content=body)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"PocketBase 不可用：{exc.__class__.__name__}") from exc

    excluded = {
        "content-encoding",
        "content-length",
        "transfer-encoding",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "upgrade",
    }
    response_headers = {k: v for k, v in upstream_resp.headers.items() if k.lower() not in excluded}
    content_type = upstream_resp.headers.get("content-type")
    # Avoid streaming the httpx response out of its context manager (StreamConsumed).
    return Response(
        content=upstream_resp.content,
        status_code=upstream_resp.status_code,
        headers=response_headers,
        media_type=content_type,
    )


@app.get("/api/bootstrap")
def bootstrap() -> dict:
    # Public bootstrap: return only non-sensitive fields; login requires /api/login anyway.
    users = []
    for user in list_users():
        users.append(_safe_user(user))
    return {"users": users, "teacherNotices": []}


@app.post("/api/login")
def login(payload: LoginRequest) -> dict:
    user = verify_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="账号或密码错误。")
    session = create_session(user["username"])
    safe = {**user}
    safe.pop("password", None)
    return {"user": safe, "token": session["token"], "expiresAt": session["expiresAt"]}


@app.post("/api/logout")
def logout(current_user: dict = Depends(require_current_user)) -> Response:
    token = current_user.get("sessionToken") or ""
    delete_session(token)
    return Response(status_code=204)


@app.get("/api/accounts")
def accounts(current_user: dict = Depends(require_current_user)) -> dict:
    level = current_user.get("level") or ""
    if level == "P1":
        return {"users": list_users_for_client(include_passwords=False)}
    # Non-P1 users can only see their own non-sensitive profile.
    user = get_user(current_user["username"])
    safe = _safe_user(user)
    return {"users": [safe] if safe else []}


@app.post("/api/accounts/passwords/unlock")
def unlock_account_passwords(payload: dict = Body(default_factory=dict), current_user: dict = Depends(require_current_user)) -> dict:
    if current_user.get("level") != "P1":
        raise HTTPException(status_code=403, detail="仅 P1 可查看账号密码。")
    passphrase = payload.get("passphrase") or payload.get("password") or ""
    if not verify_password_view_passphrase(passphrase):
        create_operation_log(current_user, "account_password_unlock_failed", "account", "*", {})
        raise HTTPException(status_code=403, detail="口令错误。")
    create_operation_log(current_user, "account_password_unlock", "account", "*", {})
    return {"users": list_users_for_client(include_passwords=True, passphrase=passphrase)}


@app.get("/api/teacher-notices")
def teacher_notices(current_user: dict = Depends(require_current_user)) -> dict:
    return {"notices": list_teacher_notices()}


@app.post("/api/teacher-notices")
def post_teacher_notice(payload: TeacherNoticePayload, current_user: dict = Depends(require_current_user)) -> dict:
    if current_user.get("level") not in {"P1", "T1"}:
        raise HTTPException(status_code=403, detail="仅 P1/T1 可发布教师留言。")
    data = payload.model_dump()
    data["authorUsername"] = current_user.get("username", "")
    data["authorDisplayName"] = current_user.get("displayName", "")
    notice = create_teacher_notice(data)
    create_operation_log(current_user, "teacher_notice_create", "teacher_notice", notice["id"], {"title": notice.get("title", "")})
    return {"notice": notice}


@app.delete("/api/teacher-notices/{notice_id}", status_code=204)
def remove_teacher_notice(notice_id: str, current_user: dict = Depends(require_current_user)) -> Response:
    notice = get_teacher_notice(notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="留言不存在。")
    if current_user.get("level") != "P1" and notice.get("authorUsername") != current_user.get("username"):
        raise HTTPException(status_code=403, detail="仅 P1 或留言创建者可删除。")
    if not delete_teacher_notice(notice_id):
        raise HTTPException(status_code=500, detail="删除留言失败。")
    create_operation_log(current_user, "teacher_notice_delete", "teacher_notice", notice_id, {"title": notice.get("title", "")})
    return Response(status_code=204)


@app.post("/api/teacher-notices/{notice_id}/receipts")
def receive_teacher_notice(
    notice_id: str,
    payload: TeacherNoticeReceiptPayload,
    current_user: dict = Depends(require_current_user),
) -> dict:
    if not get_teacher_notice(notice_id):
        raise HTTPException(status_code=404, detail="留言不存在。")
    receipt = {
        "username": current_user.get("username", ""),
        "displayName": current_user.get("displayName", ""),
        "level": current_user.get("level", ""),
        "receivedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    notice = save_teacher_notice_receipts(notice_id, [receipt])
    create_operation_log(current_user, "teacher_notice_confirm", "teacher_notice", notice_id, {})
    return {"notice": notice}


@app.post("/api/accounts")
def create_account(payload: UserPayload, current_user: dict = Depends(require_current_user)) -> dict:
    if current_user.get("level") != "P1":
        raise HTTPException(status_code=403, detail="权限不足。")
    if get_user(payload.username):
        raise HTTPException(status_code=409, detail="账号已存在。")
    user = create_user(payload.model_dump())
    create_operation_log(current_user, "account_create", "account", payload.username, {"level": payload.level})
    return {"user": _safe_user(user)}


@app.put("/api/accounts/{username}")
def update_account(
    username: str,
    payload: dict = Body(default_factory=dict),
    current_user: dict = Depends(require_current_user),
) -> dict:
    if current_user.get("level") != "P1" and current_user.get("username") != username:
        raise HTTPException(status_code=403, detail="权限不足。")
    existing = get_user(username)
    if not existing:
        raise HTTPException(status_code=404, detail="账号不存在。")

    payload_username = payload.get("username")
    if payload_username and payload_username != username:
        raise HTTPException(status_code=400, detail="不支持修改账号编号。")

    if current_user.get("level") != "P1":
        blocked = sorted(set(payload.keys()) & ACCOUNT_SENSITIVE_FIELDS)
        if blocked:
            raise HTTPException(status_code=403, detail=f"非 P1 不能修改敏感字段：{', '.join(blocked)}。")
        disallowed = sorted(set(payload.keys()) - ACCOUNT_SELF_UPDATE_FIELDS - {"username"})
        if disallowed:
            raise HTTPException(status_code=403, detail=f"不能修改字段：{', '.join(disallowed)}。")

    merged = _merge_account_payload(existing, payload)
    updated = update_user(username, merged)

    sensitive_changed = {
        key: {"before": existing.get(key), "after": updated.get(key)}
        for key in ("role", "level", "ownerType", "isActive")
        if existing.get(key) != updated.get(key)
    }
    if current_user.get("level") == "P1":
        action = "account_permission_update" if sensitive_changed else "account_update"
        create_operation_log(current_user, action, "account", username, sensitive_changed or {"fields": sorted(payload.keys())})
    return {"user": _safe_user(updated)}


@app.delete("/api/accounts/{username}", status_code=204)
def remove_account(username: str, current_user: dict = Depends(require_current_user)) -> Response:
    if current_user.get("level") != "P1":
        raise HTTPException(status_code=403, detail="权限不足。")
    if not get_user(username):
        raise HTTPException(status_code=404, detail="账号不存在。")
    if not delete_user(username):
        raise HTTPException(status_code=500, detail="删除账号失败。")
    create_operation_log(current_user, "account_delete", "account", username, {})
    return Response(status_code=204)


@app.get("/api/operation-logs")
def operation_logs(limit: int = 100, current_user: dict = Depends(require_current_user)) -> dict:
    if current_user.get("level") != "P1":
        raise HTTPException(status_code=403, detail="权限不足。")
    return {"logs": list_operation_logs(limit)}


@app.get("/api/semesters")
async def semesters(current_user: dict = Depends(require_current_user)) -> dict:
    if current_user.get("level") not in {"P1", "T1"}:
        raise HTTPException(status_code=403, detail="权限不足。")
    semester_items = await _pb_list_all("Semesters")
    week_items = await _pb_list_all("Teaching_Weeks", sort="week_number")
    return {"semesters": semester_items, "teachingWeeks": week_items}


@app.post("/api/semesters")
async def create_semester(payload: dict = Body(default_factory=dict), current_user: dict = Depends(require_current_user)) -> dict:
    if current_user.get("level") != "P1":
        raise HTTPException(status_code=403, detail="仅 P1 可创建学期。")

    first_week_raw = payload.get("first_week_start_date") or "2026-03-04"
    try:
        first_week_date = date.fromisoformat(str(first_week_raw)[:10])
    except Exception as exc:
        raise HTTPException(status_code=400, detail="第一周开始日期格式不正确。") from exc

    weeks_count = max(1, min(int(payload.get("weeks_count") or 18), 30))
    status = payload.get("status") or ("active" if payload.get("set_active") else "not_started")
    display_name = payload.get("display_name") or _semester_display_name(payload)
    semester_payload = {
        "academic_year_start": int(payload.get("academic_year_start") or 2025),
        "academic_year_end": int(payload.get("academic_year_end") or 2026),
        "semester_number": payload.get("semester_number") or "第二学期",
        "season": payload.get("season") or "春季学期",
        "display_name": display_name,
        "first_week_start_date": _date_for_pb(first_week_date),
        "weeks_count": weeks_count,
        "status": status,
        "created_by": current_user.get("username", ""),
    }

    existing = await _pb_first("Semesters", filter_expr=f'display_name="{display_name}"')
    if existing:
        raise HTTPException(status_code=409, detail="学期已存在。")

    pb = get_pocketbase_client()
    if status == "active":
        for active in await _pb_list_all("Semesters", filter_expr='status="active"'):
            await pb.request("PATCH", f"/api/collections/Semesters/records/{active['id']}", json_body={"status": "ended"})

    semester = await pb.request("POST", "/api/collections/Semesters/records", json_body=semester_payload)
    weeks = []
    today = date.today()
    for index in range(weeks_count):
        start = first_week_date + timedelta(days=index * 7)
        end = start + timedelta(days=6)
        week = await pb.request(
            "POST",
            "/api/collections/Teaching_Weeks/records",
            json_body={
                "semester_id": semester["id"],
                "week_number": index + 1,
                "start_date": _date_for_pb(start),
                "end_date": _date_for_pb(end),
                "display_name": f"第{index + 1}周",
                "is_current": start <= today <= end,
            },
        )
        weeks.append(week)

    create_operation_log(
        current_user,
        "semester_create",
        "semester",
        semester["id"],
        {"display_name": display_name, "weeks_count": weeks_count, "status": status},
    )
    return {"semester": semester, "teachingWeeks": weeks}


@app.get("/api/dashboard/p1")
async def p1_dashboard(current_user: dict = Depends(require_current_user)) -> dict:
    if current_user.get("level") != "P1":
        raise HTTPException(status_code=403, detail="仅 P1 可访问领导驾驶舱。")

    users = list_users()
    p2_users = [user for user in users if user.get("level") == "P2"]
    t1_users = [user for user in users if user.get("level") == "T1"]

    try:
        semesters = await _pb_list_all("Semesters")
        teaching_weeks = await _pb_list_all("Teaching_Weeks", sort="week_number")
        students = await _pb_list_all("Students", sort="student_no")
        tasks = await _pb_list_all("Training_Tasks", filter_expr='status="published"', sort="sort_order,task_name")
        submissions = await _pb_list_all("Submissions", expand="student_id,task_id")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"训练数据库读取失败：{exc.__class__.__name__}") from exc

    active_semester = next((item for item in semesters if item.get("status") == "active"), None) or (semesters[0] if semesters else None)
    semester_weeks = [week for week in teaching_weeks if not active_semester or week.get("semester_id") == active_semester.get("id")]
    current_week = next((week for week in semester_weeks if week.get("is_current")), None)
    if not current_week:
        today = date.today()
        for week in semester_weeks:
            start = _parse_date_like(week.get("start_date", ""))
            end = _parse_date_like(week.get("end_date", ""))
            if start and end and start.date() <= today <= end.date():
                current_week = week
                break

    progress_values = [float(student.get("training_progress") or 0) for student in students]
    overall_progress = round(sum(progress_values) / len(progress_values)) if progress_values else 0
    completed_submissions = [item for item in submissions if item.get("status") == "completed"]
    scores = [float(item.get("score") or 0) for item in submissions if item.get("score") not in (None, "")]
    today_iso = date.today().isoformat()
    today_submissions = [
        item for item in submissions
        if (_parse_date_like(item.get("submitted_at", "")) or datetime.min).date().isoformat() == today_iso
    ]
    low_progress_students = [student for student in students if float(student.get("training_progress") or 0) < 50]

    submission_by_student: dict[str, list[dict]] = {}
    for submission in submissions:
        submission_by_student.setdefault(submission.get("student_id", ""), []).append(submission)

    student_progress = []
    for student in students:
        related = submission_by_student.get(student.get("id"), [])
        completed_count = len([item for item in related if item.get("status") == "completed"])
        score_values = [float(item.get("score") or 0) for item in related if item.get("score") not in (None, "")]
        latest = sorted(
            [item.get("submitted_at", "") for item in related if item.get("submitted_at")],
            reverse=True,
        )
        student_progress.append(
            {
                "name": student.get("name", ""),
                "student_no": student.get("student_no", ""),
                "class_name": student.get("class_name", ""),
                "group_name": student.get("group_name", ""),
                "training_progress": int(student.get("training_progress") or 0),
                "completed_tasks": completed_count,
                "total_tasks": len(tasks),
                "average_score": round(sum(score_values) / len(score_values), 1) if score_values else 0,
                "current_status": student.get("current_status", "not_started"),
                "last_submitted_at": latest[0] if latest else "",
                "risk": int(student.get("training_progress") or 0) < 50,
            }
        )
    student_progress.sort(key=lambda item: item["training_progress"], reverse=True)

    logs = list_operation_logs(10)
    recent_activities = [
        {
            "type": "operation_log",
            "title": log["action"],
            "actor": log["actorUsername"],
            "time": log["createdAt"],
            "target": log["targetId"],
        }
        for log in logs
    ]
    recent_activities.extend(
        {
            "type": "submission",
            "title": "学生提交实训任务",
            "actor": (item.get("expand") or {}).get("student_id", {}).get("name") or item.get("student_id", ""),
            "time": item.get("submitted_at", ""),
            "target": (item.get("expand") or {}).get("task_id", {}).get("task_name") or item.get("task_id", ""),
        }
        for item in sorted(submissions, key=lambda x: x.get("submitted_at", ""), reverse=True)[:5]
    )
    recent_activities.sort(key=lambda item: item.get("time") or "", reverse=True)

    return {
        "semester": {
            "display_name": active_semester.get("display_name") if active_semester else "2025-2026 学年 第二学期（春季学期）",
            "current_week": current_week.get("display_name") if current_week else "待接入",
        },
        "summary": {
            "students_total": len(students),
            "overall_progress": overall_progress,
            "pending_p2_confirm": 0,
            "pending_t1_review": 0,
            "overdue_count": 0,
            "today_submissions": len(today_submissions),
            "average_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "risk_students": len(low_progress_students),
        },
        "student_progress": student_progress[:20],
        "p2_performance": [
            {
                "name": user.get("displayName", user.get("username")),
                "username": user.get("username"),
                "pending_confirm": 0,
                "confirmed": 0,
                "returned": 0,
                "overdue": 0,
                "has_notice": False,
                "last_action_at": user.get("lastLoginAt", ""),
                "status": "待接入",
            }
            for user in p2_users
        ],
        "t1_supervision": [
            {
                "name": user.get("displayName", user.get("username")),
                "username": user.get("username"),
                "scope": "全部学生",
                "reviewed": 0,
                "pending": 0,
                "revision_required": 0,
                "risk_marked": 0,
                "last_review_at": user.get("lastLoginAt", ""),
            }
            for user in t1_users
        ],
        "risk_alerts": [
            {
                "type": "low_progress",
                "title": f"{student.get('name')} 实训进度低于 50%",
                "meta": f"{student.get('student_no')} · 当前 {int(student.get('training_progress') or 0)}%",
            }
            for student in low_progress_students[:10]
        ],
        "recent_activities": recent_activities[:10],
    }


@app.get("/api/week-groups/{start_date}")
def fetch_week_group(start_date: str) -> dict:
    corrected = normalize_week_start(start_date)
    return {"group": get_week_group(corrected)}


@app.put("/api/week-groups/{start_date}")
def upsert_week_group(start_date: str, payload: WeekGroupPayload) -> dict:
    corrected = normalize_week_start(start_date)
    return {"group": save_week_group(corrected, payload.group)}

@app.get("/api/week-scopes/{start_date}")
def week_scopes(start_date: str) -> dict:
    corrected = normalize_week_start(start_date)
    return {"scopes": list_week_scopes(corrected)}


@app.get("/api/weeks/{scope_user}/{start_date}")
def fetch_week(scope_user: str, start_date: str, include_media: bool = True) -> dict:
    corrected = normalize_week_start(start_date)
    if include_media:
        return {"week": get_week(scope_user, corrected)}
    return {"week": get_week_summary(scope_user, corrected)}


@app.put("/api/weeks/{scope_user}/{start_date}")
def upsert_week(scope_user: str, start_date: str, payload: WeekPayload) -> dict:
    corrected = normalize_week_start(start_date)
    return {"week": save_week(scope_user, corrected, payload.week)}


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    if DIST_DIR.exists():
        return FileResponse(DIST_DIR / "index.html")
    raise HTTPException(
        status_code=404,
        detail="前端尚未构建，请先在 frontend 目录执行 npm run build。",
)

MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

@app.get("/training", include_in_schema=False)
def serve_training_index() -> FileResponse:
    if TRAINING_DIST_DIR.exists():
        return FileResponse(TRAINING_DIST_DIR / "index.html")
    raise HTTPException(
        status_code=404,
        detail="实训内容站点尚未构建，请先在 training_frontend 目录执行 npm run build。",
    )


@app.get("/training/{full_path:path}", include_in_schema=False)
def serve_training_frontend(full_path: str):
    if not TRAINING_DIST_DIR.exists():
        raise HTTPException(
            status_code=404,
            detail="实训内容站点尚未构建，请先在 training_frontend 目录执行 npm run build。",
        )
    candidate = TRAINING_DIST_DIR / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(TRAINING_DIST_DIR / "index.html")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if full_path.startswith("api") or full_path in {"docs", "openapi.json", "redoc"}:
        raise HTTPException(status_code=404, detail="Not Found")
    if not DIST_DIR.exists():
        raise HTTPException(
            status_code=404,
            detail="前端尚未构建，请先在 frontend 目录执行 npm run build。",
        )
    candidate = DIST_DIR / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(DIST_DIR / "index.html")
