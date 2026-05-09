import type { AppSettings, Broker, BrokerDraft, BrokerResearchResult, BrokerSource, DuplicateImportMode, ImportResult, RuntimeInfo, ScoreHistoryEntry } from "./broker";

export interface ForexApi {
  listBrokers: () => Promise<Broker[]>;
  getBroker: (id: string) => Promise<Broker | null>;
  createBroker: (draft: BrokerDraft) => Promise<Broker>;
  updateBroker: (id: string, draft: BrokerDraft) => Promise<Broker>;
  deleteBroker: (id: string) => Promise<void>;
  importCsvRows: (rows: BrokerDraft[], mode: DuplicateImportMode) => Promise<ImportResult>;
  saveResearchResult: (draft: BrokerDraft) => Promise<Broker>;
  exportCsvRows: (ids?: string[]) => Promise<Broker[]>;
  listSources: (brokerId: string) => Promise<BrokerSource[]>;
  listScoreHistory: (brokerId: string) => Promise<ScoreHistoryEntry[]>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: AppSettings) => Promise<AppSettings>;
  researchBroker: (brokerName: string) => Promise<BrokerResearchResult>;
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    forexApi: ForexApi;
  }
}
