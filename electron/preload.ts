import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, BrokerDraft, DuplicateImportMode } from "../src/types/broker";

const api = {
  listBrokers: () => ipcRenderer.invoke("brokers:list"),
  getBroker: (id: string) => ipcRenderer.invoke("brokers:get", id),
  createBroker: (draft: BrokerDraft) => ipcRenderer.invoke("brokers:create", draft),
  updateBroker: (id: string, draft: BrokerDraft) => ipcRenderer.invoke("brokers:update", id, draft),
  deleteBroker: (id: string) => ipcRenderer.invoke("brokers:delete", id),
  importCsvRows: (rows: BrokerDraft[], mode: DuplicateImportMode) => ipcRenderer.invoke("brokers:importCsvRows", rows, mode),
  saveResearchResult: (draft: BrokerDraft) => ipcRenderer.invoke("brokers:saveResearchResult", draft),
  exportCsvRows: (ids?: string[]) => ipcRenderer.invoke("brokers:exportCsvRows", ids),
  listSources: (brokerId: string) => ipcRenderer.invoke("brokers:sources", brokerId),
  listScoreHistory: (brokerId: string) => ipcRenderer.invoke("scoreHistory:list", brokerId),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (settings: AppSettings) => ipcRenderer.invoke("settings:update", settings),
  researchBroker: (brokerName: string) => ipcRenderer.invoke("research:broker", brokerName),
  getRuntimeInfo: () => ipcRenderer.invoke("runtime:getInfo"),
  openExternal: (url: string) => ipcRenderer.invoke("system:openExternal", url)
};

contextBridge.exposeInMainWorld("forexApi", api);
