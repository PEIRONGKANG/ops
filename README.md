# 饮品实训周运营系统（工程版）

本项目已从原始单文件 `weekly_ops_system.html` 重构为工程化版本：

- 前端：React 19 + Vite + Tailwind CSS 4
- 后端：FastAPI
- 数据库：SQLite

旧版单文件仍保留在项目根目录，便于对照和应急使用。

## 目录结构

```text
frontend/                        React 前端源码
frontend/dist/                   已构建好的前端静态文件
backend/                         FastAPI + SQLite 后端
backend/data/                    SQLite 数据文件
.vendor/python-installer/        离线 Python 安装包
.vendor/python-wheels/           离线 Python 依赖包
assets/                          页面与报告插图资源
backups/                         原始 HTML 备份
weekly_ops_system.html           旧版离线单文件
```

## 推荐启动方式

直接双击：

- `启动工程版实训系统.bat`

也可以使用 ASCII 版脚本：

- `start_ops_training_system.bat`

## 一键启动脚本会做什么

脚本会按下面顺序自动处理：

1. 检查本机是否已有 Python 3.11。
2. 如果没有，就优先使用项目内置的 `.vendor/python-installer/python-3.11.9-amd64.exe` 静默安装。
3. 检查并创建 `.venv`。
4. 优先从 `.vendor/python-wheels/` 离线安装后端依赖；本地离线包不可用时，再尝试联网安装。
5. 优先直接使用 `frontend/dist/` 启动，不强制在新电脑重新跑 npm。
6. 自动启动 FastAPI，并打开浏览器到 [http://127.0.0.1:8000](http://127.0.0.1:8000)。

这意味着：

- 新电脑不需要预装 Node.js。
- 新电脑原则上也不需要你手动装 Python。
- 只要把整个项目文件夹原样拷过去，成功率会最高。

## 另一台 Windows 电脑如何启动

最稳妥的方式是：

1. 关闭当前电脑上的系统。
2. 把整个 `Ops_Travelologist` 文件夹完整复制到 U 盘或网盘。
3. 在另一台 Windows 电脑上解压或粘贴到任意目录。
4. 双击 `启动工程版实训系统.bat`。
5. 首次启动等待 10 到 60 秒，浏览器会自动打开。

请不要只拷 `frontend/src` 或 `backend/app` 这些源码目录。  
务必把下面这些内容一起带走：

- `.vendor`
- `backend`
- `frontend/dist`
- `assets`
- `启动工程版实训系统.bat`
- `start_ops_training_system.bat`

如果你连 `.vendor` 和 `frontend/dist` 都一起带走，新电脑即使没装开发环境，也更容易一次启动成功。

## 数据库位置

系统数据默认保存在：

- `backend/data/ops_training.db`

这里面包含：

- 账号信息
- 分组信息
- 每周运营记录
- 已保存的确认状态

## 如何迁移数据库到另一台电脑

### 方案 A：直接复制数据库文件

1. 关闭源电脑和目标电脑上的系统。
2. 从源电脑复制 `backend/data/ops_training.db`。
3. 粘贴到目标电脑相同位置，覆盖原文件：
   `backend/data/ops_training.db`
4. 再双击 `启动工程版实训系统.bat`。

### 方案 B：使用备份脚本迁移

源电脑：

1. 双击 `备份工程版数据库.bat`
2. 生成的备份会放到 `database-backups/`
3. 把该 `.db` 备份文件拷到目标电脑

目标电脑：

1. 双击 `恢复工程版数据库.bat`
2. 把备份 `.db` 文件拖到这个 bat 上
3. 恢复完成后，再双击 `启动工程版实训系统.bat`

系统在恢复前会先自动把当前数据库再备份一份到 `database-backups/`，避免误覆盖。

## 数据迁移注意事项

- 迁移数据库前，务必先关闭系统，避免数据库正在写入。
- 如果目标电脑已经有新数据，恢复前先用 `备份工程版数据库.bat` 备份一次。
- 想把 A 电脑的数据迁到 B 电脑，本质上只需要迁移 `ops_training.db` 这一份文件。

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

公网完整业务回归：

```powershell
cd frontend
..\.tools\node-v24.13.0-win-x64\npm.cmd run regression:public
```

一条命令发布到公网并自动回归：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release_public.ps1
```

这条命令默认会：
- 对 `frontend` 执行 `lint` 和 `build`
- 使用 `scripts/deploy_ubuntu.ps1` 发布到 `111.229.16.93:8000`
- 发布完成后自动跑一轮公网完整业务回归

如需跳过某一步，可选参数：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release_public.ps1 -SkipLint
powershell -ExecutionPolicy Bypass -File .\scripts\release_public.ps1 -SkipRegression
```

## 已验证项目

已在本机通过：

- `frontend`：`npm run lint`
- `frontend`：`npm run build`
- `frontend`：`npm run smoke`
- `backend`：`python -m compileall backend`
- `start_ops_training_system.bat`：可直接启动并通过健康检查

自动化烟测会输出截图和导出文件到：

- `.smoke-artifacts/`
