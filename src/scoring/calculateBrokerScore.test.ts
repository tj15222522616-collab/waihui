import { describe, expect, it } from "vitest";
import { defaultScoringWeights } from "../data/defaultSettings";
import { createEmptyBrokerDraft } from "../utils/brokerDraft";
import { calculateBrokerScore } from "./calculateBrokerScore";

describe("calculateBrokerScore", () => {
  it("scores a strong regulated broker near the top band", () => {
    const broker = {
      ...createEmptyBrokerDraft(),
      name: "Test Broker",
      website: "https://example.com",
      regulators: ["Example Regulator"],
      regulationTier: "Tier 1" as const,
      fundSegregation: true,
      negativeBalanceProtection: true,
      avgSpreadEurUsd: 0.7,
      commission: "6 USD per lot",
      depositWithdrawMethods: ["Bank", "Card", "Wallet", "Local"],
      tradingPlatforms: ["MT4", "MT5", "TradingView", "Web", "Mobile"],
      apiSupport: true,
      customerSupport: ["24/5", "Live chat", "Email", "Phone", "中文客服"],
      chineseSupport: true,
      sourceUrls: ["https://example.com/source"],
      lastUpdated: "2026-05-05"
    };

    const score = calculateBrokerScore(broker, defaultScoringWeights);

    expect(score.total).toBeGreaterThanOrEqual(90);
    expect(score.riskLevel).toBe("LOW_RESEARCH");
    expect(score.breakdown.regulationSafety).toBe(30);
  });

  it("forces unregulated brokers to at least high risk", () => {
    const broker = {
      ...createEmptyBrokerDraft(),
      name: "Unregulated High Data Broker",
      website: "https://example.com",
      regulators: [],
      regulationTier: "Unregulated" as const,
      avgSpreadEurUsd: 0.5,
      commission: "Low",
      depositWithdrawMethods: ["Bank", "Card", "Wallet", "Local"],
      tradingPlatforms: ["MT4", "MT5", "TradingView", "Web", "Mobile"],
      apiSupport: true,
      customerSupport: ["24/5", "Live chat", "Email", "Phone", "中文客服"],
      chineseSupport: true,
      sourceUrls: ["https://example.com/source"],
      lastUpdated: "2026-05-05"
    };

    const score = calculateBrokerScore(broker, defaultScoringWeights);

    expect(score.total).toBeGreaterThanOrEqual(60);
    expect(score.riskLevel).toBe("HIGH_CAUTION");
  });

  it("rescales scores when weights are changed", () => {
    const broker = {
      ...createEmptyBrokerDraft(),
      name: "Weighted Broker",
      regulationTier: "Tier 1" as const,
      fundSegregation: true,
      negativeBalanceProtection: true
    };

    const score = calculateBrokerScore(broker, {
      regulationSafety: 40,
      tradingCosts: 20,
      fundingConvenience: 10,
      platformFeatures: 10,
      customerService: 10,
      transparency: 10
    });

    expect(score.breakdown.regulationSafety).toBe(40);
  });
});
