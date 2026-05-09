import { defaultScoringWeights } from "../data/defaultSettings";
import type { BrokerDraft, BrokerScore, RegulationTier, RiskLevel, ScoringWeights, ScoreBreakdown } from "../types/broker";

const defaultSectionMax: ScoringWeights = {
  regulationSafety: 30,
  tradingCosts: 20,
  fundingConvenience: 15,
  platformFeatures: 15,
  customerService: 10,
  transparency: 10
};

const tierBaseScores: Record<RegulationTier, number> = {
  "Tier 1": 30,
  "Tier 2": 22,
  "Tier 3": 12,
  Unregulated: 0,
  Unknown: 5
};

const normalize = (value: number, defaultMax: number, configuredMax: number) => {
  if (configuredMax <= 0) return 0;
  return Math.min(configuredMax, (value / defaultMax) * configuredMax);
};

const round = (value: number) => Math.round(value * 10) / 10;

const includesAny = (values: string[], terms: string[]) => {
  const normalized = values.map((value) => value.toLowerCase());
  return terms.some((term) => normalized.some((value) => value.includes(term.toLowerCase())));
};

const riskRank: Record<RiskLevel, number> = {
  LOW_RESEARCH: 0,
  MEDIUM_VERIFY: 1,
  HIGH_CAUTION: 2,
  EXTREME_AVOID: 3
};

export const getRiskLevel = (score: number, regulationTier: RegulationTier): RiskLevel => {
  let riskLevel: RiskLevel;
  if (score >= 80) riskLevel = "LOW_RESEARCH";
  else if (score >= 60) riskLevel = "MEDIUM_VERIFY";
  else if (score >= 40) riskLevel = "HIGH_CAUTION";
  else riskLevel = "EXTREME_AVOID";

  if (regulationTier === "Unregulated" && riskRank[riskLevel] < riskRank.HIGH_CAUTION) {
    return "HIGH_CAUTION";
  }

  return riskLevel;
};

export const calculateBrokerScore = (
  broker: Pick<
    BrokerDraft,
    | "website"
    | "regulators"
    | "regulationTier"
    | "fundSegregation"
    | "negativeBalanceProtection"
    | "avgSpreadEurUsd"
    | "commission"
    | "depositWithdrawMethods"
    | "tradingPlatforms"
    | "apiSupport"
    | "customerSupport"
    | "chineseSupport"
    | "sourceUrls"
    | "lastUpdated"
  >,
  weights: ScoringWeights = defaultScoringWeights
): BrokerScore => {
  const explanation: string[] = [];

  let regulationRaw = tierBaseScores[broker.regulationTier] ?? tierBaseScores.Unknown;
  if (broker.fundSegregation) regulationRaw += 3;
  if (broker.negativeBalanceProtection) regulationRaw += 2;
  regulationRaw = Math.min(defaultSectionMax.regulationSafety, regulationRaw);

  if (broker.regulationTier === "Tier 1") explanation.push("监管等级为 Tier 1，监管安全项获得较高基础分。");
  if (broker.regulationTier === "Unregulated") explanation.push("该平台标记为未受监管，风险等级将至少为高风险。");
  if (broker.fundSegregation) explanation.push("已填写客户资金隔离信息，监管安全评分获得加分。");
  if (broker.negativeBalanceProtection) explanation.push("已填写负余额保护信息，监管安全评分获得加分。");

  let tradingCostsRaw = 8;
  if (typeof broker.avgSpreadEurUsd === "number") {
    if (broker.avgSpreadEurUsd <= 0.8) tradingCostsRaw = 20;
    else if (broker.avgSpreadEurUsd <= 1.2) tradingCostsRaw = 16;
    else if (broker.avgSpreadEurUsd <= 1.8) tradingCostsRaw = 10;
    else tradingCostsRaw = 5;
    explanation.push(`EUR/USD 平均点差为 ${broker.avgSpreadEurUsd}，已纳入交易成本评分。`);
  } else {
    explanation.push("EUR/USD 平均点差未知，交易成本采用保守默认分。");
  }

  const fundingCount = broker.depositWithdrawMethods.filter(Boolean).length;
  let fundingRaw = 5;
  if (fundingCount > 3) fundingRaw = 15;
  else if (fundingCount === 2) fundingRaw = 10;
  else if (fundingCount === 1) fundingRaw = 6;
  explanation.push(`已填写 ${fundingCount} 种出入金方式，作为便利性评分依据。`);

  let platformRaw = 0;
  if (includesAny(broker.tradingPlatforms, ["MT4"])) platformRaw += 3;
  if (includesAny(broker.tradingPlatforms, ["MT5"])) platformRaw += 3;
  if (includesAny(broker.tradingPlatforms, ["cTrader"])) platformRaw += 2;
  if (includesAny(broker.tradingPlatforms, ["TradingView"])) platformRaw += 2;
  if (includesAny(broker.tradingPlatforms, ["自研桌面端", "desktop"])) platformRaw += 2;
  if (includesAny(broker.tradingPlatforms, ["Web", "网页"])) platformRaw += 1;
  if (includesAny(broker.tradingPlatforms, ["移动端", "Mobile", "iOS", "Android"])) platformRaw += 1;
  if (broker.apiSupport) platformRaw += 1;
  platformRaw = Math.min(defaultSectionMax.platformFeatures, platformRaw);
  explanation.push("交易软件、Web/移动端和 API 支持已纳入平台功能评分。");

  let customerRaw = 0;
  if (includesAny(broker.customerSupport, ["24/5", "24x5"])) customerRaw += 3;
  if (includesAny(broker.customerSupport, ["在线", "live chat", "chat"])) customerRaw += 3;
  if (includesAny(broker.customerSupport, ["邮件", "email"])) customerRaw += 1.5;
  if (includesAny(broker.customerSupport, ["电话", "phone"])) customerRaw += 1.5;
  if (broker.chineseSupport || includesAny(broker.customerSupport, ["中文"])) customerRaw += 1;
  customerRaw = Math.min(defaultSectionMax.customerService, customerRaw);

  let transparencyRaw = 0;
  if (broker.website) transparencyRaw += 1.5;
  if (broker.regulators.length > 0) transparencyRaw += 1.5;
  if (broker.commission) transparencyRaw += 1.5;
  if (typeof broker.avgSpreadEurUsd === "number") transparencyRaw += 1.5;
  if (broker.depositWithdrawMethods.length > 0) transparencyRaw += 1;
  if (broker.sourceUrls.length > 0) transparencyRaw += 2;
  if (broker.lastUpdated) transparencyRaw += 1;
  transparencyRaw = Math.min(defaultSectionMax.transparency, transparencyRaw);

  const breakdown: ScoreBreakdown = {
    regulationSafety: round(normalize(regulationRaw, defaultSectionMax.regulationSafety, weights.regulationSafety)),
    tradingCosts: round(normalize(tradingCostsRaw, defaultSectionMax.tradingCosts, weights.tradingCosts)),
    fundingConvenience: round(normalize(fundingRaw, defaultSectionMax.fundingConvenience, weights.fundingConvenience)),
    platformFeatures: round(normalize(platformRaw, defaultSectionMax.platformFeatures, weights.platformFeatures)),
    customerService: round(normalize(customerRaw, defaultSectionMax.customerService, weights.customerService)),
    transparency: round(normalize(transparencyRaw, defaultSectionMax.transparency, weights.transparency))
  };

  const total = round(
    Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  );

  const riskLevel = getRiskLevel(total, broker.regulationTier);

  explanation.push("所有评分仅用于信息整理和研究，需要用户自行前往平台官网及监管机构官网核实。");

  return {
    total: Math.min(100, total),
    riskLevel,
    breakdown,
    explanation
  };
};
