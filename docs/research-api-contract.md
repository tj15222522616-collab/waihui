# Research API Contract

客户版建议由你自己的后端提供 Research API，桌面端只调用该接口，不在安装包内保存 Bing、SerpAPI、Tavily、OpenAI 等服务密钥。

## Endpoint

```http
POST /research/broker
Authorization: Bearer <client-token>
Content-Type: application/json
```

## Request

```json
{
  "query": "Example Markets",
  "locale": "zh-CN",
  "product": "Forex Platform Finder",
  "schemaVersion": 1,
  "requirements": [
    "return brokerDraft with importedFields",
    "return field-level evidence with sourceUrl/excerpt/confidence",
    "do not provide investment advice",
    "mark all extracted data as candidates requiring user verification"
  ]
}
```

## Response

```json
{
  "query": "Example Markets",
  "researchProvider": "Cloud Research API / Bing + Extractor",
  "searchedAt": "2026-05-09T12:00:00.000Z",
  "dataCompleteness": 72,
  "averageConfidence": 78,
  "brokerDraft": {
    "name": "Example Markets",
    "website": "https://example.com",
    "country": "United Kingdom",
    "regulators": ["FCA"],
    "regulationTier": "Tier 1",
    "fundSegregation": true,
    "negativeBalanceProtection": true,
    "avgSpreadEurUsd": 1.1,
    "commission": "No commission on standard account",
    "minDeposit": 100,
    "maxLeverage": "1:30",
    "tradingPlatforms": ["MT4", "MT5"],
    "assets": ["外汇", "指数 CFD"],
    "depositWithdrawMethods": ["银行转账", "银行卡"],
    "chineseSupport": false,
    "customerSupport": ["在线客服", "邮件"],
    "educationResources": "",
    "apiSupport": false,
    "notes": "候选资料，尚未人工核实。",
    "sourceUrls": ["https://example.com"],
    "lastUpdated": "2026-05-09",
    "importedFields": ["name", "website", "regulators", "regulationTier", "fundSegregation", "sourceUrls", "lastUpdated"]
  },
  "sources": [
    {
      "title": "Example Markets",
      "url": "https://example.com",
      "snippet": "Official website snippet",
      "status": "fetched"
    }
  ],
  "evidence": [
    {
      "field": "regulators",
      "value": "FCA",
      "sourceUrl": "https://example.com/regulation",
      "sourceTitle": "Regulation",
      "excerpt": "Example Markets is authorised and regulated by the Financial Conduct Authority.",
      "confidence": 82
    }
  ],
  "warnings": [
    "候选资料需要用户自行前往平台官网和监管机构官网核实。"
  ]
}
```

## Rules

- `importedFields` 很重要。桌面端只会把这些字段视为本次明确识别到的字段。
- 没识别到的布尔字段不要返回 false；除非来源明确写了“不支持/没有”。
- `confidence` 使用 0-100。
- 所有结论必须是候选资料，不得输出“安全”“推荐交易”等投资建议。
