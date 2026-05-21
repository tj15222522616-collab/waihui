# Forex Platform Finder Project Redesign

## 1. Product Direction

Forex Platform Finder 的第一阶段不做“全自动外汇平台排名系统”，而做一个低成本、可复核的外汇平台资料研究工具。

核心定位：

- 面向国内用户。
- Windows 桌面应用优先。
- 先做内测版，控制成本。
- 不做真实交易、不接行情、不接下单 API。
- 不自动声称平台安全。
- 所有资料都作为“候选信息”，需要用户自行核实。

第一阶段目标：

```text
用户输入平台名称或官网
系统尝试搜索/抓取/抽取公开资料
展示候选字段、来源证据、资料完整度、置信度
用户确认后保存到本地 SQLite
支持 CSV 导入导出
支持 Windows 安装包
```

## 2. Product Model

产品不应该围绕“新增平台”设计，而应该围绕“研究平台”设计。

主工作流：

1. 研究平台
2. 查看候选资料
3. 查看证据
4. 判断资料完整度
5. 保存待复核结果
6. 人工修正资料
7. 进入平台列表
8. 按评分、风险、监管、点差筛选
9. 导出 CSV

页面优先级：

```text
Research        核心首页
Brokers         已保存平台
Dashboard       统计和 Top 5
Import/Export   批量数据
Settings        评分、研究服务、偏好
About           免责声明
```

“Add Broker” 不作为主入口，只作为人工修正和补充资料的辅助能力。

## 3. Low-Cost Architecture

第一阶段使用本地优先架构：

```text
Electron Desktop App
  React UI
  SQLite
  Local scoring engine
  Local CSV import/export
  Local fallback research
  Optional cloud Research API
```

云端 Research API 是可选项，不是第一天必须上线。

低成本策略：

- 默认不买搜索 API。
- 默认不买代码签名证书。
- 默认不使用付费大模型。
- 搜索结果缓存 7-30 天。
- 优先让用户输入官网域名，减少搜索次数。
- 每个平台最多抓取 3-5 个来源。
- 资料不足时保存为“待复核”，不强行评分结论。

## 4. Future Production Architecture

当有真实付费用户后，再升级为：

```text
Windows Desktop App
  Local SQLite
  Evidence review UI
  Score engine
  CSV tools

Cloud Research API
  Search provider adapter
  Page fetcher
  Field extractor
  Evidence generator
  Confidence scoring
  Rate limit
  Logs
```

桌面端只保存你的后端 endpoint 和 client token，不保存 Bing、Tavily、SerpAPI、LLM 等服务密钥。

## 5. Research Result Standard

任何自动研究结果必须包含：

- 字段值
- 来源 URL
- 原文摘录
- 字段置信度
- 资料完整度
- 是否需要复核
- 更新时间

布尔字段规则：

```text
明确识别到支持    -> 是
明确识别到不支持  -> 否
没有证据          -> 未识别
```

不能把“没有识别到”当成“否”。

## 6. Scoring Rules

评分仍然保留 100 分模型，但显示时必须同时显示资料完整度。

规则：

- `score` 表示根据候选字段计算出的分数。
- `dataCompleteness` 表示资料是否足够完整。
- `averageConfidence` 表示字段证据是否可靠。
- 如果资料完整度低，结果标记为“待复核”。
- 如果监管等级 Unknown，不应给出乐观风险结论。
- 如果 Unregulated，最低强制高风险。

建议前端文案：

```text
该评分基于候选资料自动计算，不构成投资建议。资料完整度不足时，不建议作为筛选依据。
```

## 7. Database Direction

当前 SQLite 表可以继续用：

```text
brokers
broker_sources
score_history
settings
```

下一阶段增加：

```text
research_jobs
research_evidence
schema_migrations
```

原因：

- `research_jobs` 记录每次研究任务。
- `research_evidence` 存字段级证据。
- `schema_migrations` 支持客户升级版本。

第一阶段可以暂时不加表，先把证据保存在运行结果里。

## 8. Windows Delivery Plan

第一阶段：

```text
npm run test
npm run typecheck
npm run build
npm run dist:win
```

先做未签名安装包，用于内测。

第二阶段：

- Windows 真机测试。
- GitHub Actions 自动打包。
- 私有发布。
- 用户反馈收集。

第三阶段：

- 代码签名。
- 自动更新。
- 崩溃日志。
- 正式客户发布。

## 9. Cost Control Plan

第一阶段预算目标：

```text
首年 150 - 600 元
```

不做：

- 不买 EV 代码签名。
- 不买 SerpAPI 高级套餐。
- 不上复杂云数据库。
- 不上 CDN。
- 不上付费监控。
- 不默认用大模型抽取。

先做：

- 本地应用。
- 免费搜索额度。
- 规则抽取。
- 手动复核。
- CSV 导入导出。

## 10. Implementation Roadmap

### Milestone 1: Internal Build

- GitHub 仓库。
- Windows CI。
- 本地 SQLite 稳定。
- Research 页面可用。
- CSV 可用。
- 免责声明完整。

### Milestone 2: Review Workflow

- 待复核状态。
- 字段级证据持久化。
- 研究历史。
- 对比更新。

### Milestone 3: Cloud Research

- Research API 后端。
- 搜索源接入。
- 抽取规则服务化。
- 结果缓存。
- 调用限流。

### Milestone 4: Customer Release

- Windows 签名安装包。
- 自动更新。
- 隐私政策。
- 用户协议。
- 客户支持邮箱。

## 11. Current Decision

当前项目应继续使用 Electron，不切 Tauri。

理由：

- 现有代码已经基于 Electron 跑通。
- SQLite native 依赖已处理。
- Windows NSIS 打包已配置。
- 切 Tauri 会引入 Rust、WebView2、插件迁移和数据库重写成本。
- 当前更重要的是验证产品需求，不是优化安装包体积。

## 12. Non-Goals

明确不做：

- 不做真实交易。
- 不做下单。
- 不接券商交易 API。
- 不做投资建议。
- 不做“平台安全认证”。
- 不绕过监管机构官网核实。

所有结论都必须以“需要用户自行核实”为前提。
