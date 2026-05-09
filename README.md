# Forex Platform Finder

Forex Platform Finder 是一款 Windows 桌面交付目标的外汇平台资料研究工具。核心流程是输入平台名称后联网搜索公开资料，抽取候选字段，用户核实后保存并自动评分。它不提供真实交易、下单、行情订阅或投资建议。

## 1. 技术方案说明

当前开发环境有 Node/npm，但没有 Rust/Cargo，因此 MVP 使用 Electron 兜底实现，而不是 Tauri v2。技术栈：

- Electron + React + TypeScript + Vite
- SQLite，本地数据库位于 Electron `app.getPath("userData")/forex-platform-finder.sqlite`
- Tailwind CSS + Radix/shadcn 风格基础组件
- PapaParse CSV 导入导出
- Zod CSV 基础校验
- Vitest 单元测试
- electron-builder Windows NSIS 安装包

正式 Windows 安装包建议在 Windows 本机或 Windows CI 构建，尤其是 `better-sqlite3` 这类原生依赖需要目标平台编译。

## 2. 项目初始化命令

```bash
npm install
```

本仓库已包含 Vite/Electron 项目文件；如果从零搭建，等价初始化路径是：

```bash
npm create vite@latest . -- --template react-ts
npm install electron better-sqlite3 papaparse zod lucide-react @radix-ui/react-dialog @radix-ui/react-slot tailwindcss
```

## 3. 目录结构

```text
electron/
  main/
    db.ts
    index.ts
  preload.ts
src/
  app/
  components/
  data/
  pages/
  scoring/
  services/
  styles/
  types/
  utils/
```

## 4. 数据库 schema

核心表位于 `electron/main/db.ts`：

- `brokers`：平台主体信息，数组字段以 JSON text 保存。
- `broker_sources`：每个平台的数据来源链接，预留 `lastCheckedAt` 给未来抓取更新。
- `score_history`：每次新增、更新或评分设置变化后写入评分历史。
- `settings`：保存评分权重、阈值、排序、深色模式和 CSV 字段映射。

## 5. 核心 TypeScript 类型

类型定义在 `src/types/broker.ts`：

- `Broker`
- `BrokerDraft`
- `BrokerScore`
- `ScoreBreakdown`
- `RiskLevel`
- `RegulationTier`
- `BrokerSource`
- `BrokerFilters`
- `ScoringWeights`
- `ImportValidationResult`

## 6. 评分模块代码

评分逻辑位于 `src/scoring/calculateBrokerScore.ts`。默认权重：

- 监管安全：30
- 交易成本：20
- 出入金便利性：15
- 平台功能：15
- 客户服务：10
- 信息透明度：10

监管等级为 `Unregulated` 时，风险等级最低强制为“高风险 / 谨慎考虑”。所有评分解释都会提示用户自行核实。

## 7. Electron 后端数据库代码

Electron 主进程位于：

- `electron/main/index.ts`：窗口创建和 IPC 注册。
- `electron/main/db.ts`：SQLite 初始化、CRUD、seed、导入合并、评分历史、设置保存。
- `electron/preload.ts`：通过 `contextBridge` 暴露 typed API，Renderer 不直接访问 Node/SQLite。

## 8. React 页面与组件代码

主要页面：

- `ResearchPage`：输入平台名称，联网搜索、抓取来源、抽取候选字段、预览评分、确认保存。
- `DashboardPage`：指标、Top 5、免责声明。
- `BrokersPage`：表格、搜索、排序、监管/中文/平台/风险筛选。
- `BrokerFormPage`：仅用于人工修正已保存资料，含基础校验和评分预览。
- `BrokerDetailPage`：完整详情、评分解释、风险提示、来源和评分历史。
- `ImportExportPage`：CSV 导入、字段校验、重复处理、筛选导出。
- `SettingsPage`：评分权重、阈值、排序、深色模式、高风险显示、CSV 映射。
- `AboutPage`：合规声明和应用边界。

## 9. CSV 导入导出代码

CSV 工具位于 `src/utils/csv.ts`：

- 使用 PapaParse 解析和导出。
- `name` 必填。
- 缺失官网、国家、监管、费用来源等字段给 warning。
- 重复平台名称按 `trim().toLowerCase()` 检测。
- 导入重复项支持跳过或合并。
- 数组字段导出时使用 `;` 分隔。

## 10. mock 数据

`src/data/mockBrokers.ts` 内置 8 个虚构平台。所有 mock 数据均标注：

> 示例数据，非实时排名，非投资建议，需要用户自行核实。

## 11. 合规声明

本应用仅用于信息整理和研究，不构成投资建议。外汇和 CFD 交易存在高风险，平台监管状态、费用、点差和政策可能变化。用户应自行前往监管机构官网和平台官网核实信息。

## 12. 如何运行

```bash
npm run dev
```

仅预览前端：

```bash
npm run dev:renderer
```

前端预览模式会使用浏览器内存 mock API；桌面应用运行时使用 Electron + SQLite。

联网研究功能在桌面应用中由 Electron 主进程执行，当前 MVP 使用免 API key 的公开网页搜索和规则抽取。抓取结果会标记为候选资料，用户确认后才写入本地数据库。

客户交付版建议在设置页启用“云端 Research API”，把搜索、抓取和字段抽取放到你的后端服务。桌面端只接收候选资料、字段证据、资料完整度和平均置信度。接口约定见 `docs/research-api-contract.md`，交付清单见 `docs/customer-delivery-checklist.md`。

为了 Windows 落地更稳定，联网搜索支持按环境变量优先使用正式搜索服务，均未配置时才退回 DuckDuckGo HTML 兜底：

```bash
BING_SEARCH_API_KEY=你的_key npm run dev
SERPAPI_API_KEY=你的_key npm run dev
TAVILY_API_KEY=你的_key npm run dev
```

`npm run dev:renderer` 只启动浏览器预览，页面会显示预览模式提示，此模式不执行真实联网搜索、不写入 SQLite。

如果 Electron postinstall 下载二进制在当前网络环境中卡住，可先使用前端预览命令检查 UI，或配置可访问镜像后重新运行安装：

```bash
ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/ npm install
npm run electron:install
npm run electron:check
```

如果启动桌面壳时报 `better-sqlite3` 的 `NODE_MODULE_VERSION` 不匹配，说明 SQLite 原生模块需要按 Electron ABI 重编：

```bash
npm run rebuild:native
```

开发服务器固定使用 `127.0.0.1:5173`；如果该端口被旧 Vite 进程占用，请先停止旧进程后再运行 `npm run dev`。

## 13. 如何打包 Windows 安装包

```bash
npm run dist:win
```

推荐在 Windows 本机或 Windows CI 执行，避免 native SQLite 依赖跨平台构建问题。

## 14. 后续可扩展功能建议

- 网页抓取任务队列和手动复核工作流。
- 监管编号、牌照实体名称、监管辖区字段。
- 来源可信度评分和来源快照。
- 评分历史趋势图。
- 数据库备份/恢复和 CSV 模板下载。
- Windows 自动更新。
- 多语言界面。

## 常用命令

```bash
npm run test
npm run typecheck
npm run build
npm run dist:win
```
