import sqlite3
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .database import (
    create_class_item,
    create_audit_log,
    create_certification,
    create_course_score,
    create_course_batch,
    create_session,
    create_group,
    create_group_member,
    create_resource,
    create_schedule_assignment,
    create_showcase_score,
    create_term,
    create_user,
    delete_class_item,
    delete_certification,
    delete_course_score,
    delete_course_batch,
    delete_group,
    delete_group_member,
    delete_resource,
    delete_schedule_assignment,
    delete_showcase_score,
    delete_term,
    delete_user,
    get_foundation_bootstrap,
    get_session_by_token,
    get_user,
    get_week_entry,
    get_week,
    get_week_group,
    init_db,
    list_audit_logs,
    list_users,
    revoke_session,
    save_week,
    save_week_group,
    update_user,
    update_week_workflow,
    verify_user,
)
from .schemas import (
    CertificationPayload,
    ClassPayload,
    CourseScorePayload,
    CourseBatchPayload,
    GroupMemberPayload,
    GroupPayload,
    LoginRequest,
    ResourcePayload,
    ScheduleAssignmentPayload,
    ShowcaseScorePayload,
    TermPayload,
    UserPayload,
    WorkflowActionPayload,
    WeekGroupPayload,
    WeekPayload,
)


ROOT_DIR = Path(__file__).resolve().parents[2]
DIST_DIR = ROOT_DIR / "frontend" / "dist"


app = FastAPI(title="Drink Training Ops API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


def _sanitize_user(user: Optional[Dict]) -> Optional[Dict]:
    if not user:
        return None
    return {
        "username": user["username"],
        "role": user["role"],
        "level": user["level"],
        "displayName": user["displayName"],
        "ownerType": user["ownerType"],
        "passwordUpdatedAt": user.get("passwordUpdatedAt", ""),
        "nameUpdatedAt": user.get("nameUpdatedAt", ""),
    }


def _get_bearer_token(request: Request) -> str:
    authorization = request.headers.get("Authorization", "").strip()
    if not authorization.lower().startswith("bearer "):
        return ""
    return authorization[7:].strip()


def _get_session(request: Request) -> Optional[Dict]:
    token = _get_bearer_token(request)
    if not token:
        return None
    session = get_session_by_token(token)
    if session:
        session["token"] = token
    return session


def _get_actor(request: Request) -> Optional[Dict]:
    session = _get_session(request)
    if session:
        return get_user(session["username"])

    actor_username = request.headers.get("X-Actor-Username", "").strip()
    if actor_username:
        return get_user(actor_username)
    return None


def _require_actor(request: Request) -> Dict:
    actor = _get_actor(request)
    if not actor:
        raise HTTPException(status_code=401, detail="缺少操作人信息。")
    return actor


def _require_p1(request: Request) -> Dict:
    actor = _require_actor(request)
    if actor["level"] != "P1":
        raise HTTPException(status_code=403, detail="仅 P1 可执行该操作。")
    return actor


def _require_reviewer(request: Request) -> Dict:
    actor = _require_actor(request)
    if actor["level"] not in {"P1", "P2"}:
        raise HTTPException(status_code=403, detail="仅 P1 / P2 可执行该操作。")
    return actor


def _get_scope_usernames(request: Request) -> Dict:
    session = _get_session(request)
    if session:
        return {
            "primary": session["username"],
            "allowed": [session["username"]] + session["pairedUsernames"],
        }

    actor = _require_actor(request)
    return {
        "primary": actor["username"],
        "allowed": [actor["username"]],
    }


def _require_scope_read_access(request: Request, scope_user: str) -> Dict:
    actor = _require_actor(request)
    if actor["level"] in {"P1", "P2"}:
        return actor

    scope = _get_scope_usernames(request)
    if scope_user not in scope["allowed"]:
        raise HTTPException(status_code=403, detail="无权访问该学员数据。")
    return actor


def _require_scope_write_access(request: Request, scope_user: str) -> Dict:
    actor = _require_actor(request)
    if actor["level"] == "P1":
        return actor
    if actor["level"] == "P2":
        raise HTTPException(status_code=403, detail="P2 无权修改学员周数据。")

    scope = _get_scope_usernames(request)
    if scope_user not in scope["allowed"]:
        raise HTTPException(status_code=403, detail="无权修改该学员数据。")
    return actor


def _as_conflict(error: sqlite3.IntegrityError) -> HTTPException:
    return HTTPException(status_code=409, detail=str(error) or "数据冲突。")


def _transition_week_workflow(
    request: Request,
    payload: WorkflowActionPayload,
    next_status: str,
    allowed_levels: set,
    action: str,
) -> dict:
    actor = _require_actor(request)
    if actor["level"] not in allowed_levels:
        raise HTTPException(status_code=403, detail="当前角色无权执行该流转动作。")
    if payload.resourceType != "week":
        raise HTTPException(status_code=400, detail="当前仅支持 week 工作流。")
    if not payload.scopeUser or not payload.startDate:
        raise HTTPException(status_code=400, detail="week 工作流需要 scopeUser 和 startDate。")

    if next_status == "submitted":
        _require_scope_write_access(request, payload.scopeUser)
    elif next_status in {"approved", "rejected"}:
        _require_reviewer(request)
    elif next_status == "archived":
        _require_p1(request)

    current = get_week_entry(payload.scopeUser, payload.startDate)
    if not current:
        raise HTTPException(status_code=404, detail="周记录不存在。")

    current_status = current["workflow"]["status"] or "draft"
    allowed_transitions = {
        "draft": {"submitted"},
        "rejected": {"submitted"},
        "submitted": {"approved", "rejected"},
        "approved": {"archived"},
        "archived": set(),
    }
    if next_status not in allowed_transitions.get(current_status, set()):
        raise HTTPException(status_code=409, detail="当前状态不允许执行该流转动作。")

    updated = update_week_workflow(
        payload.scopeUser,
        payload.startDate,
        next_status,
        actor["username"],
        payload.comment,
    )
    create_audit_log(
        {
            "actorUsername": actor["username"],
            "action": action,
            "resourceType": "week",
            "resourceId": "{0}:{1}".format(payload.scopeUser, payload.startDate),
            "targetScope": payload.scopeUser,
            "beforeStatus": current_status,
            "afterStatus": next_status,
            "detail": {"comment": payload.comment},
        }
    )
    return {"workflow": updated["workflow"]}


def _filter_foundation_payload_for_actor(request: Request, actor: Dict, payload: dict) -> dict:
    if actor["level"] in {"P1", "P2"}:
        return payload

    scope = _get_scope_usernames(request)
    allowed_usernames = set(scope["allowed"])
    filtered = dict(payload)
    filtered["certifications"] = [
        item for item in payload.get("certifications", [])
        if item.get("studentUsername") in allowed_usernames
    ]
    filtered["courseScores"] = [
        item for item in payload.get("courseScores", [])
        if item.get("studentUsername") in allowed_usernames
    ]
    filtered["showcaseScores"] = [
        item for item in payload.get("showcaseScores", [])
        if item.get("studentUsername") in allowed_usernames
    ]
    filtered["groupMembers"] = [
        item for item in payload.get("groupMembers", [])
        if item.get("studentUsername") in allowed_usernames
    ]
    return filtered


@app.get("/api/bootstrap")
def bootstrap() -> dict:
    return {"users": [_sanitize_user(user) for user in list_users()]}


@app.post("/api/login")
def login(payload: LoginRequest) -> dict:
    user = verify_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="账号或密码错误。")
    session_users = [user["username"]]
    if payload.secondUsername or payload.secondPassword:
        if not payload.secondUsername or not payload.secondPassword:
            raise HTTPException(status_code=400, detail="如需双人登录，请完整填写账号二和密码二。")
        second_user = verify_user(payload.secondUsername, payload.secondPassword)
        if not second_user:
            raise HTTPException(status_code=401, detail="第二账号或密码错误。")
        if second_user["username"] == user["username"]:
            raise HTTPException(status_code=400, detail="双人登录不能重复填写同一账号。")
        if user["level"] != "P3" or second_user["level"] != "P3":
            raise HTTPException(status_code=400, detail="双人登录仅支持学生账号。")
        session_users.append(second_user["username"])
    session = create_session(user["username"], session_users)
    actor = _sanitize_user(user)
    return {"token": session["token"], "actor": actor, "user": actor, "sessionUsers": session_users}


@app.get("/api/session")
def session_status(request: Request) -> dict:
    session = _get_session(request)
    if not session:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录。")
    actor = get_user(session["username"])
    if not actor:
        raise HTTPException(status_code=401, detail="当前会话用户不存在。")
    return {"actor": _sanitize_user(actor), "sessionUsers": [session["username"]] + session["pairedUsernames"]}


@app.post("/api/logout", status_code=204)
def logout(request: Request) -> Response:
    token = _get_bearer_token(request)
    if not token or not revoke_session(token):
        raise HTTPException(status_code=401, detail="当前会话无效。")
    return Response(status_code=204)


@app.get("/api/accounts")
def accounts(request: Request) -> dict:
    _require_p1(request)
    return {"users": [_sanitize_user(user) for user in list_users()]}


@app.post("/api/accounts")
def create_account(payload: UserPayload, request: Request) -> dict:
    _require_p1(request)
    if get_user(payload.username):
        raise HTTPException(status_code=409, detail="账号已存在。")
    return {"user": create_user(payload.model_dump())}


@app.put("/api/accounts/{username}")
def update_account(username: str, payload: UserPayload, request: Request) -> dict:
    _require_p1(request)
    if not get_user(username):
        raise HTTPException(status_code=404, detail="账号不存在。")
    if payload.username != username:
        raise HTTPException(status_code=400, detail="不支持修改账号编号。")
    return {"user": update_user(username, payload.model_dump())}


@app.delete("/api/accounts/{username}", status_code=204)
def remove_account(username: str, request: Request) -> Response:
    _require_p1(request)
    if not get_user(username):
        raise HTTPException(status_code=404, detail="账号不存在。")
    if not delete_user(username):
        raise HTTPException(status_code=500, detail="删除账号失败。")
    return Response(status_code=204)


@app.get("/api/foundation/bootstrap")
def foundation_bootstrap(request: Request) -> dict:
    actor = _require_actor(request)
    return _filter_foundation_payload_for_actor(request, actor, get_foundation_bootstrap())


@app.post("/api/terms")
def create_term_entry(request: Request, payload: TermPayload) -> dict:
    _require_p1(request)
    try:
        return {"term": create_term(payload.model_dump())}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/terms/{term_id}", status_code=204)
def remove_term(term_id: int, request: Request) -> Response:
    _require_p1(request)
    if not delete_term(term_id):
        raise HTTPException(status_code=404, detail="学期不存在。")
    return Response(status_code=204)


@app.post("/api/classes")
def create_class_entry(request: Request, payload: ClassPayload) -> dict:
    _require_p1(request)
    try:
        return {"classItem": create_class_item(payload.model_dump())}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/classes/{class_id}", status_code=204)
def remove_class(class_id: int, request: Request) -> Response:
    _require_p1(request)
    if not delete_class_item(class_id):
        raise HTTPException(status_code=404, detail="班级不存在。")
    return Response(status_code=204)


@app.post("/api/course-batches")
def create_course_batch_entry(request: Request, payload: CourseBatchPayload) -> dict:
    _require_p1(request)
    try:
        return {"courseBatch": create_course_batch(payload.model_dump())}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/course-batches/{batch_id}", status_code=204)
def remove_course_batch(batch_id: int, request: Request) -> Response:
    _require_p1(request)
    if not delete_course_batch(batch_id):
        raise HTTPException(status_code=404, detail="课程批次不存在。")
    return Response(status_code=204)


@app.post("/api/groups")
def create_group_entry(request: Request, payload: GroupPayload) -> dict:
    _require_p1(request)
    try:
        return {"group": create_group(payload.model_dump())}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/groups/{group_id}", status_code=204)
def remove_group(group_id: int, request: Request) -> Response:
    _require_p1(request)
    if not delete_group(group_id):
        raise HTTPException(status_code=404, detail="分组不存在。")
    return Response(status_code=204)


@app.post("/api/group-members")
def create_group_member_entry(request: Request, payload: GroupMemberPayload) -> dict:
    _require_p1(request)
    try:
        return {"groupMember": create_group_member(payload.model_dump())}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/group-members/{member_id}", status_code=204)
def remove_group_member(member_id: int, request: Request) -> Response:
    _require_p1(request)
    if not delete_group_member(member_id):
        raise HTTPException(status_code=404, detail="组员记录不存在。")
    return Response(status_code=204)


@app.post("/api/schedule-assignments")
def create_schedule_assignment_entry(request: Request, payload: ScheduleAssignmentPayload) -> dict:
    _require_p1(request)
    try:
        return {"scheduleAssignment": create_schedule_assignment(payload.model_dump())}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/schedule-assignments/{assignment_id}", status_code=204)
def remove_schedule_assignment(assignment_id: int, request: Request) -> Response:
    _require_p1(request)
    if not delete_schedule_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="排班记录不存在。")
    return Response(status_code=204)


@app.post("/api/resources")
def create_resource_entry(request: Request, payload: ResourcePayload) -> dict:
    actor = _require_p1(request)
    resource_payload = payload.model_dump()
    resource_payload["createdBy"] = actor["displayName"] or actor["username"]
    return {"resource": create_resource(resource_payload)}


@app.delete("/api/resources/{resource_id}", status_code=204)
def remove_resource(resource_id: int, request: Request) -> Response:
    _require_p1(request)
    if not delete_resource(resource_id):
        raise HTTPException(status_code=404, detail="资源不存在。")
    return Response(status_code=204)


@app.post("/api/certifications")
def create_certification_entry(request: Request, payload: CertificationPayload) -> dict:
    actor = _require_reviewer(request)
    certification_payload = payload.model_dump()
    certification_payload["evaluatedBy"] = actor["displayName"] or actor["username"]
    try:
        return {"certification": create_certification(certification_payload)}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/certifications/{certification_id}", status_code=204)
def remove_certification(certification_id: int, request: Request) -> Response:
    _require_reviewer(request)
    if not delete_certification(certification_id):
        raise HTTPException(status_code=404, detail="岗位认证记录不存在。")
    return Response(status_code=204)


@app.post("/api/course-scores")
def create_course_score_entry(request: Request, payload: CourseScorePayload) -> dict:
    actor = _require_reviewer(request)
    course_score_payload = payload.model_dump()
    course_score_payload["evaluatedBy"] = actor["displayName"] or actor["username"]
    try:
        return {"courseScore": create_course_score(course_score_payload)}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/course-scores/{score_id}", status_code=204)
def remove_course_score(score_id: int, request: Request) -> Response:
    _require_reviewer(request)
    if not delete_course_score(score_id):
        raise HTTPException(status_code=404, detail="课程评分记录不存在。")
    return Response(status_code=204)


@app.post("/api/showcase-scores")
def create_showcase_score_entry(request: Request, payload: ShowcaseScorePayload) -> dict:
    actor = _require_reviewer(request)
    showcase_score_payload = payload.model_dump()
    showcase_score_payload["evaluatedBy"] = actor["displayName"] or actor["username"]
    try:
        return {"showcaseScore": create_showcase_score(showcase_score_payload)}
    except sqlite3.IntegrityError as error:
        raise _as_conflict(error) from error


@app.delete("/api/showcase-scores/{score_id}", status_code=204)
def remove_showcase_score(score_id: int, request: Request) -> Response:
    _require_reviewer(request)
    if not delete_showcase_score(score_id):
        raise HTTPException(status_code=404, detail="展示赛评分记录不存在。")
    return Response(status_code=204)


@app.get("/api/week-groups/{start_date}")
def fetch_week_group(start_date: str) -> dict:
    return {"group": get_week_group(start_date)}


@app.put("/api/week-groups/{start_date}")
def upsert_week_group(start_date: str, payload: WeekGroupPayload) -> dict:
    return {"group": save_week_group(start_date, payload.group)}


@app.get("/api/weeks/{scope_user}/{start_date}")
def fetch_week(scope_user: str, start_date: str, request: Request) -> dict:
    _require_scope_read_access(request, scope_user)
    week_entry = get_week_entry(scope_user, start_date)
    return {
        "week": week_entry["payload"] if week_entry else None,
        "workflow": week_entry["workflow"] if week_entry else None,
    }


@app.put("/api/weeks/{scope_user}/{start_date}")
def upsert_week(scope_user: str, start_date: str, payload: WeekPayload, request: Request) -> dict:
    _require_scope_write_access(request, scope_user)
    return {"week": save_week(scope_user, start_date, payload.week)}


@app.post("/api/workflows/submit")
def submit_workflow_action(request: Request, payload: WorkflowActionPayload) -> dict:
    return _transition_week_workflow(request, payload, "submitted", {"P1", "P2", "P3"}, "submit")


@app.post("/api/workflows/approve")
def approve_workflow_action(request: Request, payload: WorkflowActionPayload) -> dict:
    return _transition_week_workflow(request, payload, "approved", {"P1", "P2"}, "approve")


@app.post("/api/workflows/reject")
def reject_workflow_action(request: Request, payload: WorkflowActionPayload) -> dict:
    return _transition_week_workflow(request, payload, "rejected", {"P1", "P2"}, "reject")


@app.post("/api/workflows/archive")
def archive_workflow_action(request: Request, payload: WorkflowActionPayload) -> dict:
    return _transition_week_workflow(request, payload, "archived", {"P1"}, "archive")


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    if DIST_DIR.exists():
        return FileResponse(DIST_DIR / "index.html")
    raise HTTPException(
        status_code=404,
        detail="前端尚未构建，请先在 frontend 目录执行 npm run build。",
    )


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
