import { calculateBrokerScore } from "../scoring/calculateBrokerScore";
import { defaultSettings } from "../data/defaultSettings";
import { mockBrokers } from "../data/mockBrokers";
import type { ForexApi } from "../types/electron";
import type { AppSettings, Broker, BrokerDraft, BrokerResearchResult, BrokerSource, DuplicateImportMode, ImportResult, RuntimeInfo, ScoreHistoryEntry } from "../types/broker";
import { mergeBrokerDrafts, normalizeBrokerDraft } from "../utils/brokerDraft";
import { calculateAverageEvidenceConfidence, calculateResearchCompleteness } from "../utils/researchQuality";
import { normalizeSafeExternalUrl } from "../utils/urlSafety";

const nowIso = () => new Date().toISOString();
const createId = () => crypto.randomUUID();

let browserSettings: AppSettings = defaultSettings;
let browserBrokers: Broker[] = mockBrokers.map((draft) => {
  const score = calculateBrokerScore(draft, defaultSettings.scoringWeights);
  const timestamp = nowIso();
  return {
    ...draft,
    id: createId(),
    score: score.total,
    riskLevel: score.riskLevel,
    scoreBreakdown: score.breakdown,
    scoreExplanation: score.explanation,
    isMock: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
});
let browserScoreHistory: ScoreHistoryEntry[] = [];

const toDraft = (broker: Broker): BrokerDraft => ({
  id: broker.id,
  name: broker.name,
  website: broker.website,
  country: broker.country,
  regulators: broker.regulators,
  regulationTier: broker.regulationTier,
  fundSegregation: broker.fundSegregation,
  negativeBalanceProtection: broker.negativeBalanceProtection,
  avgSpreadEurUsd: broker.avgSpreadEurUsd,
  commission: broker.commission,
  minDeposit: broker.minDeposit,
  maxLeverage: broker.maxLeverage,
  tradingPlatforms: broker.tradingPlatforms,
  assets: broker.assets,
  depositWithdrawMethods: broker.depositWithdrawMethods,
  chineseSupport: broker.chineseSupport,
  customerSupport: broker.customerSupport,
  educationResources: broker.educationResources,
  apiSupport: broker.apiSupport,
  notes: broker.notes,
  sourceUrls: broker.sourceUrls,
  lastUpdated: broker.lastUpdated,
  isMock: broker.isMock
});

const createBrowserBroker = (input: BrokerDraft): Broker => {
  const draft = normalizeBrokerDraft(input);
  if (!draft.name) throw new Error("平台名称不能为空。");
  const timestamp = nowIso();
  const score = calculateBrokerScore(draft, browserSettings.scoringWeights);
  const broker: Broker = {
    ...draft,
    id: input.id ?? createId(),
    score: score.total,
    riskLevel: score.riskLevel,
    scoreBreakdown: score.breakdown,
    scoreExplanation: score.explanation,
    isMock: Boolean(draft.isMock),
    createdAt: timestamp,
    updatedAt: timestamp
  };
  browserBrokers = [broker, ...browserBrokers];
  browserScoreHistory.unshift({
    id: createId(),
    brokerId: broker.id,
    score: broker.score,
    riskLevel: broker.riskLevel,
    scoreBreakdown: broker.scoreBreakdown,
    reason: "浏览器预览数据变更",
    createdAt: timestamp
  });
  return broker;
};

const saveBrowserResearchResult = async (draft: BrokerDraft) => {
  const existing = browserBrokers.find((broker) => broker.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
  if (!existing) return createBrowserBroker(draft);
  const merged = mergeBrokerDrafts(toDraft(existing), draft);
  return browserApi.updateBroker(existing.id, merged);
};

const createBrowserResearchResult = async (brokerName: string): Promise<BrokerResearchResult> => {
  const cleanedName = brokerName.trim();
  if (!cleanedName) throw new Error("请输入平台名称。");
  const draft = normalizeBrokerDraft({
    name: cleanedName,
    website: `https://www.example.com/${cleanedName.toLowerCase().replace(/\s+/g, "-")}`,
    country: "Unknown",
    regulators: ["示例监管关键词"],
    regulationTier: "Unknown",
    fundSegregation: false,
    negativeBalanceProtection: false,
    avgSpreadEurUsd: null,
    commission: "",
    minDeposit: null,
    maxLeverage: "",
    tradingPlatforms: ["MT4", "MT5"],
    assets: ["外汇", "指数 CFD"],
    depositWithdrawMethods: ["银行转账", "银行卡"],
    chineseSupport: false,
    customerSupport: ["在线客服", "邮件"],
    educationResources: "",
    apiSupport: false,
    notes: "浏览器预览模式下的示例联网研究结果；桌面应用会由 Electron 主进程执行真实联网搜索。",
    sourceUrls: [`https://www.example.com/search?q=${encodeURIComponent(cleanedName)}`],
    lastUpdated: new Date().toISOString().slice(0, 10),
    importedFields: [
      "name",
      "website",
      "country",
      "regulators",
      "regulationTier",
      "tradingPlatforms",
      "assets",
      "depositWithdrawMethods",
      "customerSupport",
      "notes",
      "sourceUrls",
      "lastUpdated"
    ]
  });
  const sources = [
    {
      title: `${cleanedName} 示例来源`,
      url: draft.sourceUrls[0],
      snippet: "浏览器预览模式不执行真实联网搜索，桌面版本会抓取搜索结果和来源页面。",
      status: "searched" as const
    }
  ];
  const evidence: BrokerResearchResult["evidence"] = [];
  const dataCompleteness = calculateResearchCompleteness(draft, evidence, sources);
  return {
    query: cleanedName,
    brokerDraft: draft,
    sources,
    evidence,
    warnings: ["当前是浏览器预览模式，未执行真实联网抓取。"],
    searchedAt: new Date().toISOString(),
    researchProvider: "浏览器预览 Mock",
    dataCompleteness,
    averageConfidence: calculateAverageEvidenceConfidence(evidence, dataCompleteness),
    requiresReview: true
  };
};

const browserApi: ForexApi = {
  listBrokers: async () => [...browserBrokers],
  getBroker: async (id) => browserBrokers.find((broker) => broker.id === id) ?? null,
  createBroker: async (draft) => createBrowserBroker(draft),
  updateBroker: async (id, draft) => {
    const index = browserBrokers.findIndex((broker) => broker.id === id);
    if (index < 0) throw new Error("未找到要更新的平台。");
    const mergedDraft = normalizeBrokerDraft({ ...draft, id, isMock: draft.isMock ?? browserBrokers[index].isMock });
    const score = calculateBrokerScore(mergedDraft, browserSettings.scoringWeights);
    const updated: Broker = {
      ...browserBrokers[index],
      ...mergedDraft,
      id,
      score: score.total,
      riskLevel: score.riskLevel,
      scoreBreakdown: score.breakdown,
      scoreExplanation: score.explanation,
      updatedAt: nowIso()
    };
    browserBrokers[index] = updated;
    return updated;
  },
  deleteBroker: async (id) => {
    browserBrokers = browserBrokers.filter((broker) => broker.id !== id);
  },
  importCsvRows: async (rows, mode: DuplicateImportMode): Promise<ImportResult> => {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], warnings: [] };
    rows.forEach((row) => {
      const duplicate = browserBrokers.find((broker) => broker.name.trim().toLowerCase() === row.name.trim().toLowerCase());
      if (duplicate && mode === "skip") {
        result.skipped += 1;
        result.warnings.push(`${row.name} 已存在，已跳过。`);
        return;
      }
      if (duplicate) {
        const merged = mergeBrokerDrafts(toDraft(duplicate), row);
        void browserApi.updateBroker(duplicate.id, merged);
        result.updated += 1;
        return;
      }
      createBrowserBroker(row);
      result.created += 1;
    });
    return result;
  },
  saveResearchResult: saveBrowserResearchResult,
  exportCsvRows: async (ids?: string[]) => (!ids?.length ? browserBrokers : browserBrokers.filter((broker) => ids.includes(broker.id))),
  listSources: async (brokerId: string): Promise<BrokerSource[]> => {
    const broker = browserBrokers.find((item) => item.id === brokerId);
    return (broker?.sourceUrls ?? []).map((url) => ({ id: createId(), brokerId, url, createdAt: nowIso() }));
  },
  listScoreHistory: async (brokerId) => browserScoreHistory.filter((entry) => entry.brokerId === brokerId),
  getSettings: async () => browserSettings,
  updateSettings: async (settings) => {
    browserSettings = settings;
    browserBrokers = browserBrokers.map((broker) => {
      const score = calculateBrokerScore(toDraft(broker), settings.scoringWeights);
      return { ...broker, score: score.total, riskLevel: score.riskLevel, scoreBreakdown: score.breakdown, scoreExplanation: score.explanation };
    });
    return browserSettings;
  },
  researchBroker: createBrowserResearchResult,
  getRuntimeInfo: async (): Promise<RuntimeInfo> => ({
    mode: "browser-preview",
    realWebResearch: false,
    message: "当前是浏览器预览模式：联网研究使用示例数据。请用 npm run dev 启动 Electron 桌面窗口测试真实联网研究和 SQLite。",
    searchProviders: []
  }),
  openExternal: async (url) => {
    window.open(normalizeSafeExternalUrl(url), "_blank", "noopener,noreferrer");
  }
};

export const forexApi: ForexApi = window.forexApi ?? browserApi;
