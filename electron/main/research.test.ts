import { describe, expect, it } from "vitest";
import { buildBrokerResearchResult, researchBrokerFromWeb } from "./research";
import { mergeBrokerDrafts, normalizeBrokerDraft } from "../../src/utils/brokerDraft";

const hit = {
  title: "Example Markets",
  url: "https://example.com",
  snippet: "Example Markets forex broker"
};

describe("research draft extraction", () => {
  it("does not mark booleans as imported when the web text has no explicit signal", () => {
    const result = buildBrokerResearchResult(
      "Example Markets",
      [hit],
      [
        {
          ...hit,
          text: "Example Markets offers MT5 and bank transfer. EUR/USD spreads from 1.1 pips.",
          status: "fetched"
        }
      ],
      "bing"
    );

    expect(result.brokerDraft.fundSegregation).toBe(false);
    expect(result.brokerDraft.importedFields).not.toContain("fundSegregation");
    expect(result.brokerDraft.importedFields).not.toContain("negativeBalanceProtection");

    const existing = normalizeBrokerDraft({
      name: "Example Markets",
      fundSegregation: true,
      negativeBalanceProtection: true
    });
    const merged = mergeBrokerDrafts(existing, result.brokerDraft);

    expect(merged.fundSegregation).toBe(true);
    expect(merged.negativeBalanceProtection).toBe(true);
  });

  it("marks an explicit negative boolean as imported so it can update stale data", () => {
    const result = buildBrokerResearchResult(
      "Example Markets",
      [hit],
      [
        {
          ...hit,
          text: "Example Markets does not offer negative balance protection. Client funds are segregated.",
          status: "fetched"
        }
      ],
      "bing"
    );

    expect(result.brokerDraft.importedFields).toContain("negativeBalanceProtection");
    expect(result.brokerDraft.negativeBalanceProtection).toBe(false);
    expect(result.brokerDraft.importedFields).toContain("fundSegregation");
    expect(result.brokerDraft.fundSegregation).toBe(true);
  });

  it("returns a manual draft instead of throwing when no source is available", () => {
    const result = buildBrokerResearchResult("中文平台", [], [], "manual", ["搜索服务暂不可用。"]);

    expect(result.brokerDraft.name).toBe("中文平台");
    expect(result.brokerDraft.website).toBe("");
    expect(result.brokerDraft.importedFields).toEqual(["name", "notes", "lastUpdated"]);
    expect(result.warnings).toContain("本次没有可抓取来源，已生成空白研究草稿供人工补充；不会自动声称平台安全。");
  });

  it("rejects very short ambiguous queries before trying web search", async () => {
    await expect(researchBrokerFromWeb("ex")).rejects.toThrow("输入过短");
  });
});
