# Customer Delivery Checklist

这份清单用于把 Forex Platform Finder 从开发版推进到可交付 Windows 客户版。

## 你需要准备

- Windows 10/11 测试电脑，至少一台干净系统。
- GitHub 仓库或其他 CI 环境，用于 Windows 自动打包。
- Windows 代码签名证书，建议 OV 或 EV。
- 一个正式域名，例如 `api.yourdomain.com`。
- 云端 Research API 服务器。
- 搜索服务账号：Bing Search API、Tavily 或 SerpAPI 任选其一作为主搜索源。
- 后端日志和调用量监控。
- 隐私政策、免责声明、用户协议。
- 客户支持邮箱。

## 开发交付流程

1. 桌面端继续使用 Electron + React + SQLite。
2. 搜索、抓取、字段抽取放到云端 Research API。
3. 桌面端设置页填写 API Endpoint 和 Client Token。
4. 桌面端展示候选资料、字段证据、资料完整度和平均置信度。
5. 用户确认后才写入本地 SQLite。
6. Windows CI 执行测试、构建、签名和 NSIS 打包。
7. 客户通过安装包安装，不接触开发命令、localhost 或 API key。

## Windows 打包要求

```powershell
npm ci
npm run rebuild:native
npm run test
npm run typecheck
npm run build
npm run dist:win
```

发布前必须验证：

- 安装包能在干净 Windows 机器安装。
- 桌面端首次启动能创建 SQLite。
- Research API 配置后能返回候选资料。
- API 失败时不会崩溃，会退回本地兜底或显示待复核草稿。
- 导入导出 CSV 正常。
- 评分结果和风险等级不构成投资建议。
- 外部链接只允许 http/https。
- 卸载后不会破坏用户数据，或者提供清晰的数据清理选项。

## 合规要求

- 页面显著显示“不构成投资建议”。
- 不接入真实交易、不下单、不展示实时行情承诺。
- 不自动声称任何平台安全。
- 所有候选字段都显示来源和证据。
- 监管、费用、点差、政策必须提示用户自行核实。

## 后续版本建议

- 监管编号和牌照实体名称字段。
- 证据快照存档。
- Research Job 队列和批量更新。
- 自动更新。
- 崩溃日志。
- 数据库备份/恢复。
- 企业版 license 激活。
