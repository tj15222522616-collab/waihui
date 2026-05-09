import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { ForexDatabase } from "./db";
import type { AppSettings, BrokerDraft, DuplicateImportMode } from "../../src/types/broker";
import { normalizeSafeExternalUrl } from "../../src/utils/urlSafety";
import { researchBrokerFromWeb } from "./research";

let mainWindow: BrowserWindow | null = null;
let database: ForexDatabase | null = null;

const getDatabase = () => {
  if (!database) {
    const dbPath = path.join(app.getPath("userData"), "forex-platform-finder.sqlite");
    database = new ForexDatabase(dbPath);
  }
  return database;
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: "Forex Platform Finder",
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: path.join(__dirname, "../preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
};

app.whenReady().then(async () => {
  getDatabase();
  registerIpcHandlers();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  database?.close();
  database = null;
});

const registerIpcHandlers = () => {
  ipcMain.handle("brokers:list", () => getDatabase().listBrokers());
  ipcMain.handle("brokers:get", (_event, id: string) => getDatabase().getBroker(id));
  ipcMain.handle("brokers:create", (_event, draft: BrokerDraft) => getDatabase().createBroker(draft));
  ipcMain.handle("brokers:update", (_event, id: string, draft: BrokerDraft) => getDatabase().updateBroker(id, draft));
  ipcMain.handle("brokers:delete", (_event, id: string) => getDatabase().deleteBroker(id));
  ipcMain.handle("brokers:importCsvRows", (_event, rows: BrokerDraft[], mode: DuplicateImportMode) => getDatabase().importBrokers(rows, mode));
  ipcMain.handle("brokers:saveResearchResult", (_event, draft: BrokerDraft) => getDatabase().saveResearchResult(draft));
  ipcMain.handle("brokers:exportCsvRows", (_event, ids?: string[]) => getDatabase().exportBrokers(ids));
  ipcMain.handle("brokers:sources", (_event, brokerId: string) => getDatabase().listSources(brokerId));
  ipcMain.handle("scoreHistory:list", (_event, brokerId: string) => getDatabase().listScoreHistory(brokerId));
  ipcMain.handle("settings:get", () => getDatabase().getSettings());
  ipcMain.handle("settings:update", (_event, settings: AppSettings) => getDatabase().updateSettings(settings));
  ipcMain.handle("research:broker", (_event, brokerName: string) => researchBrokerFromWeb(brokerName, getDatabase().getSettings()));
  ipcMain.handle("runtime:getInfo", () => ({
    mode: "desktop",
    realWebResearch: true,
    message: "Electron 桌面模式：真实联网研究由主进程执行，保存到本机 SQLite。",
    searchProviders: ["Bing Search API", "SerpAPI", "Tavily", "DuckDuckGo HTML fallback", "官网候选直连兜底"]
  }));
  ipcMain.handle("system:openExternal", (_event, url: string) => openSafeExternalUrl(url));
};

const openSafeExternalUrl = async (url: string) => {
  return shell.openExternal(normalizeSafeExternalUrl(url));
};
