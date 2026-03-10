from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .database import (
    create_user,
    get_user,
    get_week,
    get_week_group,
    init_db,
    list_users,
    save_week,
    save_week_group,
    update_user,
    verify_user,
)
from .schemas import LoginRequest, UserPayload, WeekGroupPayload, WeekPayload


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


@app.get("/api/bootstrap")
def bootstrap() -> dict:
    return {"users": list_users()}


@app.post("/api/login")
def login(payload: LoginRequest) -> dict:
    user = verify_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="账号或密码错误。")
    return {"user": user}


@app.get("/api/accounts")
def accounts() -> dict:
    return {"users": list_users()}


@app.post("/api/accounts")
def create_account(payload: UserPayload) -> dict:
    if get_user(payload.username):
        raise HTTPException(status_code=409, detail="账号已存在。")
    return {"user": create_user(payload.model_dump())}


@app.put("/api/accounts/{username}")
def update_account(username: str, payload: UserPayload) -> dict:
    if not get_user(username):
        raise HTTPException(status_code=404, detail="账号不存在。")
    if payload.username != username:
        raise HTTPException(status_code=400, detail="不支持修改账号编号。")
    return {"user": update_user(username, payload.model_dump())}


@app.get("/api/week-groups/{start_date}")
def fetch_week_group(start_date: str) -> dict:
    return {"group": get_week_group(start_date)}


@app.put("/api/week-groups/{start_date}")
def upsert_week_group(start_date: str, payload: WeekGroupPayload) -> dict:
    return {"group": save_week_group(start_date, payload.group)}


@app.get("/api/weeks/{scope_user}/{start_date}")
def fetch_week(scope_user: str, start_date: str) -> dict:
    return {"week": get_week(scope_user, start_date)}


@app.put("/api/weeks/{scope_user}/{start_date}")
def upsert_week(scope_user: str, start_date: str, payload: WeekPayload) -> dict:
    return {"week": save_week(scope_user, start_date, payload.week)}


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
