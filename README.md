# 见微 · Go + React + MongoDB

本地个人博主观点复盘工具。前端 React 19 + Vite 8，后端 Go `net/http`，数据库为真实 MongoDB 8。保留博主档案、观点台账、复盘评分、搜索筛选、JSON 导入导出和笔记原图。

「观点日历」按原始发表日期展示月历，支持切换月份、回到今天和沿用搜索筛选。点击日期查看当天全部观点，点击观点打开完整详情；计划回看日期和复盘日期不参与日历归档。

## 启动：Docker Compose

启动 Docker Desktop 后，在本目录执行：

```powershell
docker compose up --build -d --wait
```

打开 **http://127.0.0.1:4180**。只需 Docker Desktop，无需在宿主机安装 Go、Node.js 或 MongoDB。构建阶段由 Node 编译 React、Go 编译后端；运行时只有 `app` 和 `mongo` 两个容器，Go 提供 API 与前端静态文件。`--wait` 等待应用和数据库健康检查通过后返回。

MongoDB 数据保存在 `mongo-data` 命名卷，端口只发布至 `127.0.0.1`。后台容器无需保持终端打开。查看状态和日志：

```powershell
docker compose ps
docker compose logs -f app mongo
```

`docker compose down` 停止服务并保留卷；不要附加 `-v`，除非确实要删除数据库数据。

旧站的 4173 保留供导出浏览器数据。之前便携模式的 `.local/mongo` 与 Docker 命名卷是两个独立数据目录；已有记录请先导出 JSON，再在 Docker 版恢复。旧数据和下载缓存未删除。

## 开发

要求 Go 1.25+、Node.js 22.12+、MongoDB。具体依赖已锁在 `go.mod`、`go.sum` 和两个 `package-lock.json` 中。

```powershell
# 项目根目录，首次安装前端依赖
npm --prefix frontend ci

# 启动开发用数据库
docker compose up -d --wait mongo

# 终端一，启动 Go
cd backend
go run ./cmd/server

# 终端二，从项目根目录启动 React 热更新
npm run dev
```

开发前端为 http://127.0.0.1:5173 ，`/api` 代理到 Go 的 4180。构建 React：`npm run build`。在 `backend` 目录执行 `go build -o ../.local/jianwei.exe ./cmd/server` 生成后端程序。

后端读取进程环境变量，`.env.example` 只是配置示例，不会由 `go run` 自动加载：

| 变量 | 默认值 |
| --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` |
| `MONGODB_DATABASE` | `jianwei` |
| `HTTP_ADDR` | `127.0.0.1:4180` |
| `WEB_DIR` | `../frontend/dist`，相对后端工作目录 |
| `ALLOWED_ORIGINS` | 本机 5173 的开发前端地址 |

热更新开发前请停止 Compose 中的 `app` 容器（`docker compose stop app`），避免与本地 Go 占用同一端口。自定义 HTTP 地址时直接启动 Go 并访问对应地址。不要把连接凭据提交进仓库。

## 结构

```text
backend/cmd/server/        Go 入口、配置和优雅退出
backend/internal/domain/  数据模型与服务端校验
backend/internal/store/   MongoDB 持久化与并发控制
backend/internal/httpapi/ JSON API 与静态文件服务
frontend/src/App.jsx      数据加载、保存、导航和流程
frontend/src/components.jsx / forms.jsx / views.jsx
frontend/src/domain.js    评分、筛选和备份兼容
frontend/src/api.js       API 客户端与错误处理
frontend/src/Workbench.jsx 深色工作台、筛选条、观点表格和博主统计
frontend/src/workbench.js 组合筛选、排序与统计逻辑
frontend/src/theme.css    深色主题、详情抽屉与响应式布局
frontend/public/assets/   笔记原图
legacy/                   原静态版，供数据迁移
compose.yaml / Dockerfile 容器启动与多阶段构建
```

## 数据与 API

正式记录通过 Go API 保存到 `jianwei.workspaces`，不再写入 localStorage。个人工作区是 `_id: default` 的单个 MongoDB 文档，嵌套博主、观点和复盘；完整备份恢复与关系更新保持原子性，不依赖副本集事务。适合当前单人小站。

| 接口 | 作用 |
| --- | --- |
| `GET /api/health` | Ping MongoDB，异常返回 503 |
| `GET /api/workspace` | 读取工作区、`revision` 与 ETag |
| `PUT /api/workspace` | 保存，须提供 `If-Match: "revision"` |

原子条件替换可避免两个页面互相覆盖。缺修订号返回 428，冲突 409，校验失败 422，数据库故障 503。冲突或保存失败时保留表单，允许先导出待保存数据再载入最新版本。服务端校验重复 ID、博主关联、日期、来源 URL、四维评分、核对状态和价格。

单次请求及备份上限 8 MiB，给 MongoDB 16 MiB 文档限制留出空间。大量附件、多用户或更大规模时应拆分集合并分页；图片当前作为项目静态资源保存。该项目用于本地单人使用，没有账号体系。

## 迁移旧数据

1. 旧站仍运行时，打开 http://127.0.0.1:4173/legacy/index.html#settings 导出 JSON。根目录 `server.cjs` 是旧版兼容启动入口；也可在 `legacy` 运行 `node server.cjs` 后访问 http://127.0.0.1:4173/#settings 。
2. 新版「数据与评分规则」选择「恢复备份」，核对数量后确认。兼容 v1 个人备份，演示备份不能恢复到个人数据库。
3. 恢复会替换当前工作区，**先导出当前数据**。原始浏览器数据保留不动，笔记原图随项目目录保存，不含在 JSON 中。

同来源下若检测到旧个人 localStorage 会展示迁移入口；不同端口隔离存储，请使用 JSON。新版只读演示不写数据库。关闭网页、换浏览器或重启 MongoDB 后，正式记录仍保留在数据库。

## 验证

```powershell
# 根目录
npm test
npm run build

# backend 目录
go test ./...
$env:MONGODB_TEST_URI = 'mongodb://127.0.0.1:27017'
go test ./internal/store -count=1 -v
```

真实 MongoDB 集成测试创建并清理随机 `jianwei_test_` 前缀的独立测试库，不改动个人库。浏览器联调也使用独立测试库。

四项评分权重为方向 40%、时点 25%、风险 20%、表达 15%，每项 0–5 分。未核对记录不计分；修改原始观点会撤销旧复盘。当前由使用者录入、核对和评分，尚未接入自动抓取或行情。
