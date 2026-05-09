import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { calculateBrokerScore } from "../../src/scoring/calculateBrokerScore";
import { defaultSettings } from "../../src/data/defaultSettings";
import { mockBrokers } from "../../src/data/mockBrokers";
import type {
  AppSettings,
  Broker,
  BrokerDraft,
  BrokerSource,
  DuplicateImportMode,
  ImportResult,
  RiskLevel,
  ScoreBreakdown,
  ScoreHistoryEntry
} from "../../src/types/broker";
import { mergeBrokerDrafts, normalizeBrokerDraft } from "../../src/utils/brokerDraft";

type SqliteDatabase = Database.Database;

const APP_SETTINGS_KEY = "app";

const nowIso = () => new Date().toISOString();
const createId = () => randomUUID();

const readJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (value: unknown) => JSON.stringify(value ?? null);

const boolToInt = (value: boolean) => (value ? 1 : 0);
const intToBool = (value: unknown) => Boolean(Number(value ?? 0));

const mergeSettings = (settings: Partial<AppSettings>): AppSettings => ({
  ...defaultSettings,
  ...settings,
  scoringWeights: {
    ...defaultSettings.scoringWeights,
    ...(settings.scoringWeights ?? {})
  },
  csvFieldMapping: {
    ...defaultSettings.csvFieldMapping,
    ...(settings.csvFieldMapping ?? {})
  }
});

const mapRowToBroker = (row: Record<string, unknown>): Broker => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  website: String(row.website ?? ""),
  country: String(row.country ?? ""),
  regulators: readJson<string[]>(String(row.regulators ?? "[]"), []),
  regulationTier: (row.regulationTier as Broker["regulationTier"]) ?? "Unknown",
  fundSegregation: intToBool(row.fundSegregation),
  negativeBalanceProtection: intToBool(row.negativeBalanceProtection),
  avgSpreadEurUsd: row.avgSpreadEurUsd === null || row.avgSpreadEurUsd === undefined ? null : Number(row.avgSpreadEurUsd),
  commission: String(row.commission ?? ""),
  minDeposit: row.minDeposit === null || row.minDeposit === undefined ? null : Number(row.minDeposit),
  maxLeverage: String(row.maxLeverage ?? ""),
  tradingPlatforms: readJson<string[]>(String(row.tradingPlatforms ?? "[]"), []),
  assets: readJson<string[]>(String(row.assets ?? "[]"), []),
  depositWithdrawMethods: readJson<string[]>(String(row.depositWithdrawMethods ?? "[]"), []),
  chineseSupport: intToBool(row.chineseSupport),
  customerSupport: readJson<string[]>(String(row.customerSupport ?? "[]"), []),
  educationResources: String(row.educationResources ?? ""),
  apiSupport: intToBool(row.apiSupport),
  notes: String(row.notes ?? ""),
  sourceUrls: readJson<string[]>(String(row.sourceUrls ?? "[]"), []),
  lastUpdated: String(row.lastUpdated ?? ""),
  score: Number(row.score ?? 0),
  riskLevel: (row.riskLevel as RiskLevel) ?? "EXTREME_AVOID",
  scoreBreakdown: readJson<ScoreBreakdown>(String(row.scoreBreakdown ?? "{}"), {
    regulationSafety: 0,
    tradingCosts: 0,
    fundingConvenience: 0,
    platformFeatures: 0,
    customerService: 0,
    transparency: 0
  }),
  scoreExplanation: readJson<string[]>(String(row.scoreExplanation ?? "[]"), []),
  isMock: intToBool(row.isMock),
  createdAt: String(row.createdAt ?? ""),
  updatedAt: String(row.updatedAt ?? "")
});

const brokerToDraft = (broker: Broker): BrokerDraft => ({
  id: broker.id,
  name: broker.name,
  website: broker.website,
  country: broker.country,
  regulators: broker.regulators,
  regulationTier: broker.regulationTier,
  fundSegregation: broker.fundSegregation,
  negativeBalanceProtection: broker.negativeBalanceProtection,
  avgSpreadEurUsd: broker.avgSpreadEurUsd,
  commission: broker.commission,
  minDeposit: broker.minDeposit,
  maxLeverage: broker.maxLeverage,
  tradingPlatforms: broker.tradingPlatforms,
  assets: broker.assets,
  depositWithdrawMethods: broker.depositWithdrawMethods,
  chineseSupport: broker.chineseSupport,
  customerSupport: broker.customerSupport,
  educationResources: broker.educationResources,
  apiSupport: broker.apiSupport,
  notes: broker.notes,
  sourceUrls: broker.sourceUrls,
  lastUpdated: broker.lastUpdated,
  isMock: broker.isMock
});

const schema = `
CREATE TABLE IF NOT EXISTS brokers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  website TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  regulators TEXT NOT NULL DEFAULT '[]',
  regulationTier TEXT NOT NULL DEFAULT 'Unknown',
  fundSegregation INTEGER NOT NULL DEFAULT 0,
  negativeBalanceProtection INTEGER NOT NULL DEFAULT 0,
  avgSpreadEurUsd REAL,
  commission TEXT NOT NULL DEFAULT '',
  minDeposit REAL,
  maxLeverage TEXT NOT NULL DEFAULT '',
  tradingPlatforms TEXT NOT NULL DEFAULT '[]',
  assets TEXT NOT NULL DEFAULT '[]',
  depositWithdrawMethods TEXT NOT NULL DEFAULT '[]',
  chineseSupport INTEGER NOT NULL DEFAULT 0,
  customerSupport TEXT NOT NULL DEFAULT '[]',
  educationResources TEXT NOT NULL DEFAULT '',
  apiSupport INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sourceUrls TEXT NOT NULL DEFAULT '[]',
  lastUpdated TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0,
  riskLevel TEXT NOT NULL DEFAULT 'EXTREME_AVOID',
  scoreBreakdown TEXT NOT NULL DEFAULT '{}',
  scoreExplanation TEXT NOT NULL DEFAULT '[]',
  isMock INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS broker_sources (
  id TEXT PRIMARY KEY,
  brokerId TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  lastCheckedAt TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (brokerId) REFERENCES brokers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS score_history (
  id TEXT PRIMARY KEY,
  brokerId TEXT NOT NULL,
  score REAL NOT NULL,
  riskLevel TEXT NOT NULL,
  scoreBreakdown TEXT NOT NULL,
  reason TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (brokerId) REFERENCES brokers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export class ForexDatabase {
  private db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(schema);
    this.ensureSettings();
    this.seedMockData();
  }

  close() {
    this.db.close();
  }

  getSettings(): AppSettings {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(APP_SETTINGS_KEY) as { value?: string } | undefined;
    return mergeSettings(readJson<Partial<AppSettings>>(row?.value, defaultSettings));
  }

  updateSettings(settings: AppSettings): AppSettings {
    const merged = mergeSettings(settings);
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(APP_SETTINGS_KEY, writeJson(merged));
    this.recalculateAllScores("评分设置更新");
    return this.getSettings();
  }

  listBrokers(): Broker[] {
    const rows = this.db.prepare("SELECT * FROM brokers ORDER BY score DESC, name ASC").all() as Record<string, unknown>[];
    return rows.map(mapRowToBroker);
  }

  getBroker(id: string): Broker | null {
    const row = this.db.prepare("SELECT * FROM brokers WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapRowToBroker(row) : null;
  }

  createBroker(input: BrokerDraft): Broker {
    const draft = normalizeBrokerDraft(input);
    if (!draft.name) throw new Error("平台名称不能为空。");
    const id = input.id ?? createId();
    const createdAt = nowIso();
    const score = calculateBrokerScore(draft, this.getSettings().scoringWeights);

    try {
      this.db
        .prepare(
          `INSERT INTO brokers (
            id, name, website, country, regulators, regulationTier, fundSegregation, negativeBalanceProtection,
            avgSpreadEurUsd, commission, minDeposit, maxLeverage, tradingPlatforms, assets, depositWithdrawMethods,
            chineseSupport, customerSupport, educationResources, apiSupport, notes, sourceUrls, lastUpdated,
            score, riskLevel, scoreBreakdown, scoreExplanation, isMock, createdAt, updatedAt
          ) VALUES (
            @id, @name, @website, @country, @regulators, @regulationTier, @fundSegregation, @negativeBalanceProtection,
            @avgSpreadEurUsd, @commission, @minDeposit, @maxLeverage, @tradingPlatforms, @assets, @depositWithdrawMethods,
            @chineseSupport, @customerSupport, @educationResources, @apiSupport, @notes, @sourceUrls, @lastUpdated,
            @score, @riskLevel, @scoreBreakdown, @scoreExplanation, @isMock, @createdAt, @updatedAt
          )`
        )
        .run({
          id,
          name: draft.name,
          website: draft.website,
          country: draft.country,
          regulators: writeJson(draft.regulators),
          regulationTier: draft.regulationTier,
          fundSegregation: boolToInt(draft.fundSegregation),
          negativeBalanceProtection: boolToInt(draft.negativeBalanceProtection),
          avgSpreadEurUsd: draft.avgSpreadEurUsd,
          commission: draft.commission,
          minDeposit: draft.minDeposit,
          maxLeverage: draft.maxLeverage,
          tradingPlatforms: writeJson(draft.tradingPlatforms),
          assets: writeJson(draft.assets),
          depositWithdrawMethods: writeJson(draft.depositWithdrawMethods),
          chineseSupport: boolToInt(draft.chineseSupport),
          customerSupport: writeJson(draft.customerSupport),
          educationResources: draft.educationResources,
          apiSupport: boolToInt(draft.apiSupport),
          notes: draft.notes,
          sourceUrls: writeJson(draft.sourceUrls),
          lastUpdated: draft.lastUpdated,
          score: score.total,
          riskLevel: score.riskLevel,
          scoreBreakdown: writeJson(score.breakdown),
          scoreExplanation: writeJson(score.explanation),
          isMock: boolToInt(Boolean(draft.isMock)),
          createdAt,
          updatedAt: createdAt
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("UNIQUE")) throw new Error(`平台名称已存在：${draft.name}`);
      throw new Error(`保存研究结果失败：${message}`);
    }

    this.replaceSources(id, draft.sourceUrls);
    this.addScoreHistory(id, score.total, score.riskLevel, score.breakdown, "新增或导入平台");
    const created = this.getBroker(id);
    if (!created) throw new Error("保存研究结果后读取失败。");
    return created;
  }

  updateBroker(id: string, input: BrokerDraft): Broker {
    const existing = this.getBroker(id);
    if (!existing) throw new Error("未找到要更新的平台。");

    const draft = normalizeBrokerDraft({ ...input, id, isMock: input.isMock ?? existing.isMock });
    if (!draft.name) throw new Error("平台名称不能为空。");
    const score = calculateBrokerScore(draft, this.getSettings().scoringWeights);
    const updatedAt = nowIso();

    try {
      this.db
        .prepare(
          `UPDATE brokers SET
            name=@name, website=@website, country=@country, regulators=@regulators, regulationTier=@regulationTier,
            fundSegregation=@fundSegregation, negativeBalanceProtection=@negativeBalanceProtection, avgSpreadEurUsd=@avgSpreadEurUsd,
            commission=@commission, minDeposit=@minDeposit, maxLeverage=@maxLeverage, tradingPlatforms=@tradingPlatforms,
            assets=@assets, depositWithdrawMethods=@depositWithdrawMethods, chineseSupport=@chineseSupport, customerSupport=@customerSupport,
            educationResources=@educationResources, apiSupport=@apiSupport, notes=@notes, sourceUrls=@sourceUrls, lastUpdated=@lastUpdated,
            score=@score, riskLevel=@riskLevel, scoreBreakdown=@scoreBreakdown, scoreExplanation=@scoreExplanation, isMock=@isMock, updatedAt=@updatedAt
          WHERE id=@id`
        )
        .run({
          id,
          name: draft.name,
          website: draft.website,
          country: draft.country,
          regulators: writeJson(draft.regulators),
          regulationTier: draft.regulationTier,
          fundSegregation: boolToInt(draft.fundSegregation),
          negativeBalanceProtection: boolToInt(draft.negativeBalanceProtection),
          avgSpreadEurUsd: draft.avgSpreadEurUsd,
          commission: draft.commission,
          minDeposit: draft.minDeposit,
          maxLeverage: draft.maxLeverage,
          tradingPlatforms: writeJson(draft.tradingPlatforms),
          assets: writeJson(draft.assets),
          depositWithdrawMethods: writeJson(draft.depositWithdrawMethods),
          chineseSupport: boolToInt(draft.chineseSupport),
          customerSupport: writeJson(draft.customerSupport),
          educationResources: draft.educationResources,
          apiSupport: boolToInt(draft.apiSupport),
          notes: draft.notes,
          sourceUrls: writeJson(draft.sourceUrls),
          lastUpdated: draft.lastUpdated,
          score: score.total,
          riskLevel: score.riskLevel,
          scoreBreakdown: writeJson(score.breakdown),
          scoreExplanation: writeJson(score.explanation),
          isMock: boolToInt(Boolean(draft.isMock)),
          updatedAt
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("UNIQUE")) throw new Error(`平台名称已存在：${draft.name}`);
      throw new Error(`更新平台失败：${message}`);
    }

    this.replaceSources(id, draft.sourceUrls);
    this.addScoreHistory(id, score.total, score.riskLevel, score.breakdown, "更新平台信息");
    const updated = this.getBroker(id);
    if (!updated) throw new Error("更新平台后读取失败。");
    return updated;
  }

  deleteBroker(id: string) {
    this.db.prepare("DELETE FROM brokers WHERE id = ?").run(id);
  }

  importBrokers(rows: BrokerDraft[], duplicateMode: DuplicateImportMode): ImportResult {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], warnings: [] };

    rows.forEach((row, index) => {
      try {
        const draft = normalizeBrokerDraft(row);
        if (!draft.name) {
          result.errors.push(`第 ${index + 1} 行缺少平台名称，已跳过。`);
          result.skipped += 1;
          return;
        }

        const existing = this.findBrokerByName(draft.name);
        if (existing && duplicateMode === "skip") {
          result.skipped += 1;
          result.warnings.push(`平台 ${draft.name} 已存在，按设置跳过。`);
          return;
        }

        if (existing && duplicateMode === "merge") {
          const merged = mergeBrokerDrafts(brokerToDraft(existing), draft);
          this.updateBroker(existing.id, merged);
          result.updated += 1;
          return;
        }

        this.createBroker(draft);
        result.created += 1;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    });

    return result;
  }

  saveResearchResult(input: BrokerDraft): Broker {
    const draft = normalizeBrokerDraft(input);
    if (!draft.name) throw new Error("平台名称不能为空。");
    const existing = this.findBrokerByName(draft.name);
    if (!existing) return this.createBroker(draft);

    const merged = mergeBrokerDrafts(brokerToDraft(existing), draft);
    return this.updateBroker(existing.id, merged);
  }

  exportBrokers(ids?: string[]): Broker[] {
    if (!ids || ids.length === 0) return this.listBrokers();
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db.prepare(`SELECT * FROM brokers WHERE id IN (${placeholders}) ORDER BY score DESC, name ASC`).all(...ids) as Record<
      string,
      unknown
    >[];
    return rows.map(mapRowToBroker);
  }

  listSources(brokerId: string): BrokerSource[] {
    return this.db.prepare("SELECT * FROM broker_sources WHERE brokerId = ? ORDER BY createdAt DESC").all(brokerId) as BrokerSource[];
  }

  listScoreHistory(brokerId: string): ScoreHistoryEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM score_history WHERE brokerId = ? ORDER BY createdAt DESC LIMIT 20")
      .all(brokerId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      brokerId: String(row.brokerId),
      score: Number(row.score),
      riskLevel: row.riskLevel as RiskLevel,
      scoreBreakdown: readJson<ScoreBreakdown>(String(row.scoreBreakdown), {
        regulationSafety: 0,
        tradingCosts: 0,
        fundingConvenience: 0,
        platformFeatures: 0,
        customerService: 0,
        transparency: 0
      }),
      reason: String(row.reason ?? ""),
      createdAt: String(row.createdAt ?? "")
    }));
  }

  private ensureSettings() {
    const existing = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(APP_SETTINGS_KEY);
    if (!existing) {
      this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(APP_SETTINGS_KEY, writeJson(defaultSettings));
    }
  }

  private seedMockData() {
    const count = this.db.prepare("SELECT COUNT(*) AS count FROM brokers").get() as { count: number };
    if (count.count > 0) return;
    const insertMany = this.db.transaction(() => {
      mockBrokers.forEach((broker) => this.createBroker({ ...broker, isMock: true }));
    });
    insertMany();
  }

  private findBrokerByName(name: string): Broker | null {
    const row = this.db.prepare("SELECT * FROM brokers WHERE lower(trim(name)) = lower(trim(?))").get(name) as Record<string, unknown> | undefined;
    return row ? mapRowToBroker(row) : null;
  }

  private replaceSources(brokerId: string, urls: string[]) {
    this.db.prepare("DELETE FROM broker_sources WHERE brokerId = ?").run(brokerId);
    const insert = this.db.prepare(
      "INSERT INTO broker_sources (id, brokerId, url, title, notes, lastCheckedAt, createdAt) VALUES (?, ?, ?, '', '', NULL, ?)"
    );
    urls.filter(Boolean).forEach((url) => insert.run(createId(), brokerId, url, nowIso()));
  }

  private addScoreHistory(brokerId: string, score: number, riskLevel: RiskLevel, scoreBreakdown: ScoreBreakdown, reason: string) {
    this.db
      .prepare("INSERT INTO score_history (id, brokerId, score, riskLevel, scoreBreakdown, reason, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(createId(), brokerId, score, riskLevel, writeJson(scoreBreakdown), reason, nowIso());
  }

  private recalculateAllScores(reason: string) {
    const brokers = this.listBrokers();
    const settings = this.getSettings();
    const update = this.db.prepare(
      "UPDATE brokers SET score = ?, riskLevel = ?, scoreBreakdown = ?, scoreExplanation = ?, updatedAt = ? WHERE id = ?"
    );
    const recalculate = this.db.transaction(() => {
      brokers.forEach((broker) => {
        const score = calculateBrokerScore(brokerToDraft(broker), settings.scoringWeights);
        update.run(score.total, score.riskLevel, writeJson(score.breakdown), writeJson(score.explanation), nowIso(), broker.id);
        this.addScoreHistory(broker.id, score.total, score.riskLevel, score.breakdown, reason);
      });
    });
    recalculate();
  }
}
