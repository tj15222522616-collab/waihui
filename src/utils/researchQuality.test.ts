import { describe, expect, it } from "vitest";
import { normalizeBrokerDraft } from "./brokerDraft";
import { calculateAverageEvidenceConfidence, calculateResearchCompleteness } from "./researchQuality";

describe("research quality", () => {
  it("marks sparse research as low completeness", () => {
    const draft = normalizeBrokerDraft({
      name: "Sparse Broker",
      importedFields: ["name", "notes", "lastUpdated"]
    });

    const completeness = calculateResearchCompleteness(draft, [], []);

    expect(completeness).toBeLessThan(20);
    expect(calculateAverageEvidenceConfidence([], completeness)).toBeLessThan(20);
  });

  it("rewards field coverage, evidence, and fetched sources", () => {
    const draft = normalizeBrokerDraft({
      name: "Covered Broker",
      website: "https://example.com",
      country: "United Kingdom",
      regulators: ["FCA"],
      regulationTier: "Tier 1",
      fundSegregation: true,
      sourceUrls: ["https://example.com"],
      importedFields: ["name", "website", "country", "regulators", "regulationTier", "fundSegregation", "sourceUrls", "lastUpdated"]
    });
    const evidence = [
      {
        field: "regulators" as const,
        value: "FCA",
        sourceUrl: "https://example.com/regulation",
        excerpt: "regulated by the FCA",
        confidence: 82
      }
    ];

    const completeness = calculateResearchCompleteness(draft, evidence, [
      { title: "Regulation", url: "https://example.com/regulation", snippet: "", status: "fetched" }
    ]);

    expect(completeness).toBeGreaterThan(25);
    expect(calculateAverageEvidenceConfidence(evidence, completeness)).toBe(82);
  });
});
