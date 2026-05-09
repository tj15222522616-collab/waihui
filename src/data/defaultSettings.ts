import type { AppSettings, ScoringWeights } from "../types/broker";

export const defaultScoringWeights: ScoringWeights = {
  regulationSafety: 30,
  tradingCosts: 20,
  fundingConvenience: 15,
  platformFeatures: 15,
  customerService: 10,
  transparency: 10
};

export const defaultSettings: AppSettings = {
  scoringWeights: defaultScoringWeights,
  highScoreThreshold: 80,
  defaultSortField: "score",
  darkMode: false,
  showHighRiskPlatforms: true,
  useCloudResearchApi: false,
  researchApiEndpoint: "",
  researchApiToken: "",
  minResearchCompleteness: 55,
  csvFieldMapping: {
    name: "name",
    website: "website",
    country: "country",
    regulators: "regulators",
    regulationTier: "regulationTier",
    fundSegregation: "fundSegregation",
    negativeBalanceProtection: "negativeBalanceProtection",
    avgSpreadEurUsd: "avgSpreadEurUsd",
    commission: "commission",
    minDeposit: "minDeposit",
    maxLeverage: "maxLeverage",
    tradingPlatforms: "tradingPlatforms",
    assets: "assets",
    depositWithdrawMethods: "depositWithdrawMethods",
    chineseSupport: "chineseSupport",
    customerSupport: "customerSupport",
    educationResources: "educationResources",
    apiSupport: "apiSupport",
    notes: "notes",
    sourceUrls: "sourceUrls",
    lastUpdated: "lastUpdated"
  }
};
