import Papa from "papaparse";
import { z } from "zod";
import { defaultSettings } from "../data/defaultSettings";
import type { AppSettings, Broker, BrokerDraft, BrokerDraftDataField, ImportValidationIssue, ImportValidationResult, RegulationTier } from "../types/broker";
import { regulationTiers, riskLevelLabels } from "../types/broker";
import { createEmptyBrokerDraft, normalizeBrokerDraft, parseBoolean, parseNullableNumber, splitList } from "./brokerDraft";

const brokerCsvSchema = z.object({
  name: z.string().trim().min(1, "平台名称为必填字段")
});

const dateLike = /^\d{4}-\d{2}-\d{2}/;

const normalizeTier = (value: unknown): RegulationTier => {
  const text = String(value ?? "").trim();
  const found = regulationTiers.find((tier) => tier.toLowerCase() === text.toLowerCase());
  return found ?? "Unknown";
};

const getMappedValue = (
  record: Record<string, unknown>,
  field: BrokerDraftDataField,
  mapping: AppSettings["csvFieldMapping"]
): { value: unknown; present: boolean } => {
  const direct = record[field];
  if (direct !== undefined) return { value: direct, present: true };

  const mappedHeader = Object.entries(mapping).find(([, mappedField]) => mappedField === field)?.[0];
  if (mappedHeader && Object.prototype.hasOwnProperty.call(record, mappedHeader)) {
    return { value: record[mappedHeader], present: true };
  }
  return { value: undefined, present: false };
};

export const mapCsvRecordToDraft = (
  record: Record<string, unknown>,
  mapping: AppSettings["csvFieldMapping"] = defaultSettings.csvFieldMapping
): BrokerDraft => {
  const draft = createEmptyBrokerDraft();
  const importedFields: BrokerDraftDataField[] = [];
  const valueFor = (field: BrokerDraftDataField) => {
    const mapped = getMappedValue(record, field, mapping);
    if (mapped.present) importedFields.push(field);
    return mapped.value;
  };

  draft.name = String(valueFor("name") ?? "").trim();
  draft.website = String(valueFor("website") ?? "").trim();
  draft.country = String(valueFor("country") ?? "").trim();
  draft.regulators = splitList(valueFor("regulators"));
  draft.regulationTier = normalizeTier(valueFor("regulationTier"));
  draft.fundSegregation = parseBoolean(valueFor("fundSegregation"));
  draft.negativeBalanceProtection = parseBoolean(valueFor("negativeBalanceProtection"));
  draft.avgSpreadEurUsd = parseNullableNumber(valueFor("avgSpreadEurUsd"));
  draft.commission = String(valueFor("commission") ?? "").trim();
  draft.minDeposit = parseNullableNumber(valueFor("minDeposit"));
  draft.maxLeverage = String(valueFor("maxLeverage") ?? "").trim();
  draft.tradingPlatforms = splitList(valueFor("tradingPlatforms"));
  draft.assets = splitList(valueFor("assets"));
  draft.depositWithdrawMethods = splitList(valueFor("depositWithdrawMethods"));
  draft.chineseSupport = parseBoolean(valueFor("chineseSupport"));
  draft.customerSupport = splitList(valueFor("customerSupport"));
  draft.educationResources = String(valueFor("educationResources") ?? "").trim();
  draft.apiSupport = parseBoolean(valueFor("apiSupport"));
  draft.notes = String(valueFor("notes") ?? "").trim();
  draft.sourceUrls = splitList(valueFor("sourceUrls"));
  draft.lastUpdated = String(valueFor("lastUpdated") ?? new Date().toISOString().slice(0, 10)).trim();
  draft.importedFields = importedFields;
  return normalizeBrokerDraft(draft);
};

export const validateCsvRecords = (
  records: Record<string, unknown>[],
  existingBrokerNames: string[] = [],
  mapping: AppSettings["csvFieldMapping"] = defaultSettings.csvFieldMapping
): ImportValidationResult => {
  const issues: ImportValidationIssue[] = [];
  const validRows: BrokerDraft[] = [];
  const seen = new Set<string>();
  const existing = new Set(existingBrokerNames.map((name) => name.trim().toLowerCase()));
  const duplicateNames = new Set<string>();

  records.forEach((record, index) => {
    const row = index + 2;
    const draft = mapCsvRecordToDraft(record, mapping);
    const result = brokerCsvSchema.safeParse({ name: draft.name });
    if (!result.success) {
      issues.push({ row, field: "name", message: result.error.issues[0]?.message ?? "平台名称无效", severity: "error" });
      return;
    }

    const key = draft.name.trim().toLowerCase();
    if (seen.has(key) || existing.has(key)) duplicateNames.add(draft.name);
    seen.add(key);

    const warningFields: BrokerDraftDataField[] = ["website", "country", "regulators", "commission", "sourceUrls"];
    warningFields.forEach((field) => {
      const value = draft[field];
      const missing = Array.isArray(value) ? value.length === 0 : !value;
      if (missing) {
        issues.push({ row, field: String(field), message: "字段缺失，建议补充后再作为研究依据。", severity: "warning" });
      }
    });

    if (draft.lastUpdated && !dateLike.test(draft.lastUpdated)) {
      issues.push({ row, field: "lastUpdated", message: "更新时间建议使用 YYYY-MM-DD 格式。", severity: "warning" });
    }

    validRows.push(draft);
  });

  return {
    validRows,
    issues,
    duplicateNames: Array.from(duplicateNames)
  };
};

export const parseCsvText = (text: string): Promise<Record<string, unknown>[]> =>
  new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => resolve(result.data),
      error: (error: Error) => reject(error)
    });
  });

export const brokersToCsv = (brokers: Broker[]) => {
  const rows = brokers.map((broker) => ({
    name: broker.name,
    website: broker.website,
    country: broker.country,
    regulators: broker.regulators.join(";"),
    regulationTier: broker.regulationTier,
    fundSegregation: broker.fundSegregation ? "是" : "否",
    negativeBalanceProtection: broker.negativeBalanceProtection ? "是" : "否",
    avgSpreadEurUsd: broker.avgSpreadEurUsd ?? "",
    commission: broker.commission,
    minDeposit: broker.minDeposit ?? "",
    maxLeverage: broker.maxLeverage,
    tradingPlatforms: broker.tradingPlatforms.join(";"),
    assets: broker.assets.join(";"),
    depositWithdrawMethods: broker.depositWithdrawMethods.join(";"),
    chineseSupport: broker.chineseSupport ? "是" : "否",
    customerSupport: broker.customerSupport.join(";"),
    educationResources: broker.educationResources,
    apiSupport: broker.apiSupport ? "是" : "否",
    notes: broker.notes,
    sourceUrls: broker.sourceUrls.join(";"),
    score: broker.score,
    riskLevel: riskLevelLabels[broker.riskLevel],
    lastUpdated: broker.lastUpdated
  }));
  return Papa.unparse(rows);
};

export const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
