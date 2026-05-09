import { describe, expect, it } from "vitest";
import { brokersToCsv, mapCsvRecordToDraft, validateCsvRecords } from "./csv";
import type { Broker } from "../types/broker";
import { mergeBrokerDrafts } from "./brokerDraft";

describe("csv utils", () => {
  it("maps semicolon separated arrays and booleans", () => {
    const draft = mapCsvRecordToDraft({
      name: "CSV Broker",
      regulators: "FCA; ASIC",
      fundSegregation: "是",
      tradingPlatforms: "MT4; MT5; TradingView",
      avgSpreadEurUsd: "0.8"
    });

    expect(draft.name).toBe("CSV Broker");
    expect(draft.regulators).toEqual(["FCA", "ASIC"]);
    expect(draft.fundSegregation).toBe(true);
    expect(draft.tradingPlatforms).toContain("MT5");
    expect(draft.avgSpreadEurUsd).toBe(0.8);
  });

  it("reports missing names as errors and duplicate names", () => {
    const validation = validateCsvRecords([{ name: "" }, { name: "Alpha" }, { name: "Alpha" }], ["Existing"]);

    expect(validation.validRows).toHaveLength(2);
    expect(validation.issues.some((issue) => issue.severity === "error")).toBe(true);
    expect(validation.duplicateNames).toEqual(["Alpha"]);
  });

  it("does not overwrite existing booleans when CSV columns are missing during merge", () => {
    const existing = mapCsvRecordToDraft({
      name: "Merge Broker",
      fundSegregation: "是",
      negativeBalanceProtection: "是",
      chineseSupport: "是",
      apiSupport: "是"
    });
    const incoming = mapCsvRecordToDraft({
      name: "Merge Broker",
      website: "https://example.com/merge"
    });

    const merged = mergeBrokerDrafts(existing, incoming);

    expect(merged.website).toBe("https://example.com/merge");
    expect(merged.fundSegregation).toBe(true);
    expect(merged.negativeBalanceProtection).toBe(true);
    expect(merged.chineseSupport).toBe(true);
    expect(merged.apiSupport).toBe(true);
  });

  it("overwrites existing booleans when CSV explicitly says no during merge", () => {
    const existing = mapCsvRecordToDraft({
      name: "Merge Broker",
      fundSegregation: "是"
    });
    const incoming = mapCsvRecordToDraft({
      name: "Merge Broker",
      fundSegregation: "否"
    });

    const merged = mergeBrokerDrafts(existing, incoming);

    expect(merged.fundSegregation).toBe(false);
  });

  it("exports arrays with semicolon separators", () => {
    const broker: Broker = {
      id: "1",
      name: "Export Broker",
      website: "https://example.com",
      country: "UK",
      regulators: ["FCA", "ASIC"],
      regulationTier: "Tier 1",
      fundSegregation: true,
      negativeBalanceProtection: true,
      avgSpreadEurUsd: 1,
      commission: "None",
      minDeposit: 100,
      maxLeverage: "1:30",
      tradingPlatforms: ["MT4", "MT5"],
      assets: ["Forex"],
      depositWithdrawMethods: ["Bank", "Card"],
      chineseSupport: true,
      customerSupport: ["Email"],
      educationResources: "",
      apiSupport: false,
      notes: "",
      sourceUrls: ["https://example.com/source"],
      lastUpdated: "2026-05-05",
      score: 80,
      riskLevel: "LOW_RESEARCH",
      scoreBreakdown: {
        regulationSafety: 30,
        tradingCosts: 16,
        fundingConvenience: 10,
        platformFeatures: 10,
        customerService: 5,
        transparency: 9
      },
      scoreExplanation: [],
      isMock: false,
      createdAt: "2026-05-05T00:00:00.000Z",
      updatedAt: "2026-05-05T00:00:00.000Z"
    };

    const csv = brokersToCsv([broker]);

    expect(csv).toContain("FCA;ASIC");
    expect(csv).toContain("MT4;MT5");
  });
});
