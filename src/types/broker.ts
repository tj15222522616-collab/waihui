export const regulationTiers = ["Tier 1", "Tier 2", "Tier 3", "Unregulated", "Unknown"] as const;
export type RegulationTier = (typeof regulationTiers)[number];

export const riskLevels = ["LOW_RESEARCH", "MEDIUM_VERIFY", "HIGH_CAUTION", "EXTREME_AVOID"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const riskLevelLabels: Record<RiskLevel, string> = {
  LOW_RESEARCH: "低风险 / 值得研究",
  MEDIUM_VERIFY: "中等风险 / 需要进一步核实",
  HIGH_CAUTION: "高风险 / 谨慎考虑",
  EXTREME_AVOID: "极高风险 / 不建议使用"
};

export const riskLevelTone: Record<RiskLevel, "success" | "warning" | "danger"> = {
  LOW_RESEARCH: "success",
  MEDIUM_VERIFY: "warning",
  HIGH_CAUTION: "danger",
  EXTREME_AVOID: "danger"
};

export interface ScoringWeights {
  regulationSafety: number;
  tradingCosts: number;
  fundingConvenience: number;
  platformFeatures: number;
  customerService: number;
  transparency: number;
}

export interface ScoreBreakdown {
  regulationSafety: number;
  tradingCosts: number;
  fundingConvenience: number;
  platformFeatures: number;
  customerService: number;
  transparency: number;
}

export interface BrokerScore {
  total: number;
  riskLevel: RiskLevel;
  breakdown: ScoreBreakdown;
  explanation: string[];
}

export interface BrokerSource {
  id: string;
  brokerId: string;
  url: string;
  title?: string;
  notes?: string;
  lastCheckedAt?: string;
  createdAt: string;
}

export interface Broker {
  id: string;
  name: string;
  website: string;
  country: string;
  regulators: string[];
  regulationTier: RegulationTier;
  fundSegregation: boolean;
  negativeBalanceProtection: boolean;
  avgSpreadEurUsd: number | null;
  commission: string;
  minDeposit: number | null;
  maxLeverage: string;
  tradingPlatforms: string[];
  assets: string[];
  depositWithdrawMethods: string[];
  chineseSupport: boolean;
  customerSupport: string[];
  educationResources: string;
  apiSupport: boolean;
  notes: string;
  sourceUrls: string[];
  lastUpdated: string;
  score: number;
  riskLevel: RiskLevel;
  scoreBreakdown: ScoreBreakdown;
  scoreExplanation: string[];
  isMock: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BrokerDraftData = Omit<
  Broker,
  "id" | "score" | "riskLevel" | "scoreBreakdown" | "scoreExplanation" | "isMock" | "createdAt" | "updatedAt"
>;

export type BrokerDraftDataField = keyof BrokerDraftData;

export type BrokerDraft = BrokerDraftData & {
  id?: string;
  isMock?: boolean;
  importedFields?: BrokerDraftDataField[];
};

export interface BrokerFilters {
  search: string;
  regulationTier: "All" | RegulationTier;
  chineseSupport: "All" | "Yes" | "No";
  platform: "All" | "MT4" | "MT5";
  riskLevel: "All" | RiskLevel;
  sortBy: "score" | "avgSpreadEurUsd" | "minDeposit" | "name" | "lastUpdated";
  sortDirection: "asc" | "desc";
}

export interface AppSettings {
  scoringWeights: ScoringWeights;
  highScoreThreshold: number;
  defaultSortField: BrokerFilters["sortBy"];
  darkMode: boolean;
  showHighRiskPlatforms: boolean;
  useCloudResearchApi: boolean;
  researchApiEndpoint: string;
  researchApiToken: string;
  minResearchCompleteness: number;
  csvFieldMapping: Record<string, BrokerDraftDataField | "ignore">;
}

export interface ImportValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportValidationResult {
  validRows: BrokerDraft[];
  issues: ImportValidationIssue[];
  duplicateNames: string[];
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

export type DuplicateImportMode = "skip" | "merge";

export interface ScoreHistoryEntry {
  id: string;
  brokerId: string;
  score: number;
  riskLevel: RiskLevel;
  scoreBreakdown: ScoreBreakdown;
  reason: string;
  createdAt: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  status: "searched" | "fetched" | "failed";
}

export interface ResearchFieldEvidence {
  field: BrokerDraftDataField;
  value: string;
  sourceUrl: string;
  excerpt: string;
  confidence?: number;
  sourceTitle?: string;
}

export interface BrokerResearchResult {
  query: string;
  brokerDraft: BrokerDraft;
  sources: ResearchSource[];
  evidence: ResearchFieldEvidence[];
  warnings: string[];
  searchedAt: string;
  researchProvider: string;
  dataCompleteness: number;
  averageConfidence: number;
  requiresReview: boolean;
}

export interface RuntimeInfo {
  mode: "desktop" | "browser-preview";
  realWebResearch: boolean;
  message: string;
  searchProviders: string[];
}
