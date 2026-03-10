# 饮品实训周运营系统（工程版）

本项目已从原始单文件 `weekly_ops_system.html` 重构为可维护的工程化版本：

- 前端：React 19 + Vite + Tailwind CSS 4
- 后端：FastAPI
- 数据库：SQLite

旧版单文件仍保留在项目根目录，便于对照和应急使用。

## 目录结构

```text
frontend/                React + Tailwind 前端
backend/                 FastAPI + SQLite 后端
backend/data/            SQLite 数据文件
assets/                  页面与报告插图资源
backups/                 原始 HTML 备份
weekly_ops_system.html   旧版离线单文件
```

## 快速启动

推荐直接双击：

`启动工程版实训系统.bat`

也可以双击 ASCII 版脚本：

`start_ops_training_system.bat`

脚本会自动完成以下步骤：

- 检查或创建 `.venv`
- 安装 `backend/requirements.txt`
- 使用项目内置 Node.js 安装前端依赖
- 自动执行前端构建
- 启动 FastAPI 并打开浏览器

首次运行需要本机已安装 Python 3.11+。Node.js 不要求系统额外安装，项目自带 `.tools/node-v24.13.0-win-x64`。

启动后访问地址为：

`http://127.0.0.1:8000`

## 开发命令

后端：

```powershell
.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

前端开发：

```powershell
cd frontend
..\.tools\node-v24.13.0-win-x64\npm.cmd run dev
```

前端构建：

```powershell
cd frontend
..\.tools\node-v24.13.0-win-x64\npm.cmd run build
```

前端 lint：

```powershell
cd frontend
..\.tools\node-v24.13.0-win-x64\npm.cmd run lint
```

自动化烟测：

```powershell
cd frontend
..\.tools\node-v24.13.0-win-x64\npm.cmd run smoke
```

## 数据说明

- SQLite 文件：`backend/data/ops_training.db`
- 启动时会自动初始化账号、分组表和周数据表
- 当前实现保留了原系统的核心能力：
  - 单人/双人学生登录
  - 一周一次分组信息填写
  - 教学周次自动带出分组名单
  - 周三策划、每日运营、交接班、总结反思
  - 经理分项确认
  - 美化版周报告预览与 Word 导出

## 已验证命令

已在本机通过：

- `frontend`：`npm run lint`
- `frontend`：`npm run build`
- `frontend`：`npm run smoke`
- `backend`：`python -m compileall backend`

自动化烟测会输出截图和导出文件到：

- `.smoke-artifacts/`
