import type { BrokerDraft, BrokerDraftDataField, ResearchFieldEvidence, ResearchSource } from "../types/broker";

const qualityFields: BrokerDraftDataField[] = [
  "website",
  "country",
  "regulators",
  "regulationTier",
  "fundSegregation",
  "negativeBalanceProtection",
  "avgSpreadEurUsd",
  "commission",
  "minDeposit",
  "maxLeverage",
  "tradingPlatforms",
  "assets",
  "depositWithdrawMethods",
  "chineseSupport",
  "customerSupport",
  "educationResources",
  "apiSupport",
  "sourceUrls"
];

const hasConcreteValue = (draft: BrokerDraft, field: BrokerDraftDataField) => {
  const value = draft[field];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "" && value !== "Unknown";
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return value !== null && value !== undefined;
};

const isRecognized = (draft: BrokerDraft, field: BrokerDraftDataField) => {
  if (draft.importedFields) return draft.importedFields.includes(field);
  return hasConcreteValue(draft, field);
};

export const calculateResearchCompleteness = (draft: BrokerDraft, evidence: ResearchFieldEvidence[], sources: ResearchSource[]) => {
  const recognizedCount = qualityFields.filter((field) => isRecognized(draft, field)).length;
  const evidenceFields = new Set(evidence.map((item) => item.field));
  const evidenceCount = qualityFields.filter((field) => evidenceFields.has(field)).length;
  const fetchedSources = sources.filter((source) => source.status === "fetched").length;

  const fieldScore = (recognizedCount / qualityFields.length) * 65;
  const evidenceScore = (evidenceCount / qualityFields.length) * 25;
  const sourceScore = fetchedSources > 0 ? 10 : sources.length > 0 ? 5 : 0;

  return Math.max(0, Math.min(100, Math.round(fieldScore + evidenceScore + sourceScore)));
};

export const calculateAverageEvidenceConfidence = (evidence: ResearchFieldEvidence[], fallbackCompleteness: number) => {
  const confidenceValues = evidence.map((item) => item.confidence).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!confidenceValues.length) return Math.round(fallbackCompleteness * 0.6);
  const average = confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
  return Math.max(0, Math.min(100, Math.round(average)));
};
