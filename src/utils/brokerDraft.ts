import type { BrokerDraft, BrokerDraftDataField } from "../types/broker";

export const splitList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(/[;,，；|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const uniqueList = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

export const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value !== "string") return false;
  return ["true", "yes", "y", "1", "是", "支持", "有"].includes(value.trim().toLowerCase());
};

export const parseNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const createEmptyBrokerDraft = (): BrokerDraft => ({
  name: "",
  website: "",
  country: "",
  regulators: [],
  regulationTier: "Unknown",
  fundSegregation: false,
  negativeBalanceProtection: false,
  avgSpreadEurUsd: null,
  commission: "",
  minDeposit: null,
  maxLeverage: "",
  tradingPlatforms: [],
  assets: [],
  depositWithdrawMethods: [],
  chineseSupport: false,
  customerSupport: [],
  educationResources: "",
  apiSupport: false,
  notes: "",
  sourceUrls: [],
  lastUpdated: new Date().toISOString().slice(0, 10)
});

export const normalizeBrokerDraft = (draft: Partial<BrokerDraft>): BrokerDraft => ({
  ...createEmptyBrokerDraft(),
  ...draft,
  name: draft.name?.trim() ?? "",
  website: draft.website?.trim() ?? "",
  country: draft.country?.trim() ?? "",
  regulators: uniqueList(draft.regulators ?? []),
  tradingPlatforms: uniqueList(draft.tradingPlatforms ?? []),
  assets: uniqueList(draft.assets ?? []),
  depositWithdrawMethods: uniqueList(draft.depositWithdrawMethods ?? []),
  customerSupport: uniqueList(draft.customerSupport ?? []),
  sourceUrls: uniqueList(draft.sourceUrls ?? []),
  avgSpreadEurUsd: typeof draft.avgSpreadEurUsd === "number" ? draft.avgSpreadEurUsd : null,
  minDeposit: typeof draft.minDeposit === "number" ? draft.minDeposit : null,
  lastUpdated: draft.lastUpdated?.trim() || new Date().toISOString().slice(0, 10),
  importedFields: draft.importedFields ? (uniqueList(draft.importedFields) as BrokerDraftDataField[]) : undefined
});

const arrayMergeFields: BrokerDraftDataField[] = [
  "regulators",
  "tradingPlatforms",
  "assets",
  "depositWithdrawMethods",
  "customerSupport",
  "sourceUrls"
];

const metadataFields = new Set(["id", "isMock", "importedFields"]);

export const mergeBrokerDrafts = (existing: BrokerDraft, incoming: BrokerDraft): BrokerDraft => {
  const importedFieldSet = incoming.importedFields ? new Set<BrokerDraftDataField>(incoming.importedFields) : null;
  const hasIncomingField = (field: string) => !importedFieldSet || importedFieldSet.has(field as BrokerDraftDataField);

  const merged = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(incoming).filter(([field, value]) => {
        if (metadataFields.has(field)) return false;
        if (!hasIncomingField(field)) return false;
        if (arrayMergeFields.includes(field as BrokerDraftDataField)) return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "string") return value.trim() !== "";
        return value !== null && value !== undefined;
      })
    )
  } as BrokerDraft;

  arrayMergeFields.forEach((field) => {
    if (!hasIncomingField(field)) return;
    const existingList = (existing[field] as string[] | undefined) ?? [];
    const incomingList = (incoming[field] as string[] | undefined) ?? [];
    if (incomingList.length > 0) {
      Object.assign(merged, { [field]: uniqueList([...existingList, ...incomingList]) });
    }
  });

  delete merged.importedFields;
  return merged;
};
