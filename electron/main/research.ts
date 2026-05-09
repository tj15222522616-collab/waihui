import type {
  AppSettings,
  BrokerDraft,
  BrokerDraftDataField,
  BrokerResearchResult,
  RegulationTier,
  ResearchFieldEvidence,
  ResearchSource
} from "../../src/types/broker";
import { normalizeBrokerDraft, uniqueList } from "../../src/utils/brokerDraft";
import { calculateAverageEvidenceConfidence, calculateResearchCompleteness } from "../../src/utils/researchQuality";
import { normalizeSafeExternalUrl } from "../../src/utils/urlSafety";

const SEARCH_TIMEOUT_MS = 12000;
const PAGE_TIMEOUT_MS = 10000;
const MAX_RESULTS = 6;
const MAX_PAGE_CHARS = 140000;

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ForexPlatformFinder/0.1 Safari/537.36";

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

type SearchProviderName = "bing" | "serpapi" | "tavily" | "duckduckgo" | "direct" | "manual";

interface SearchResult {
  provider: SearchProviderName;
  hits: SearchHit[];
  warnings: string[];
}

interface FetchedPage extends SearchHit {
  text: string;
  status: ResearchSource["status"];
}

const decodeHtml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const stripHtml = (html: string) =>
  decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();

const fetchText = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeSearchUrl = (rawUrl: string) => {
  const decoded = decodeHtml(rawUrl);
  const withProtocol = decoded.startsWith("//") ? `https:${decoded}` : decoded;
  const parsed = new URL(withProtocol);
  if (parsed.hostname.includes("duckduckgo.com") && parsed.pathname.startsWith("/l/")) {
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return normalizeSafeExternalUrl(decodeURIComponent(uddg));
  }
  return normalizeSafeExternalUrl(withProtocol);
};

const getEnvValue = (key: string) => process.env[key]?.trim() ?? "";

const buildSearchQuery = (brokerName: string) => `"${brokerName}" forex broker regulation spread minimum deposit`;

const isLikelyDomain = (value: string) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value.trim());

const ensureResearchQueryIsSpecific = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) throw new Error("请输入平台名称。");
  if (cleaned.length < 3 && !isLikelyDomain(cleaned)) {
    throw new Error("输入过短，无法可靠联网研究。请输入更完整的平台名称或官网域名，例如 Example Markets 或 example.com。");
  }
};

const buildDirectCandidateHits = (brokerName: string): SearchHit[] => {
  const hits: SearchHit[] = [];
  const raw = brokerName.trim();

  if (isLikelyDomain(raw)) {
    try {
      hits.push({
        title: `${raw} 官网候选`,
        url: normalizeSafeExternalUrl(`https://${raw}`),
        snippet: "根据用户输入的域名直接生成的官网候选链接，需人工核实。"
      });
    } catch {
      // Ignore malformed user-entered domains.
    }
  }

  const domainStem = raw
    .toLowerCase()
    .replace(/\b(ltd|limited|markets|market|broker|brokers|forex|fx|group|capital|securities|global|official)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");

  if (domainStem.length >= 3) {
    [`https://www.${domainStem}.com`, `https://${domainStem}.com`].forEach((url) => {
      try {
        const safeUrl = normalizeSafeExternalUrl(url);
        if (!hits.some((hit) => hit.url === safeUrl)) {
          hits.push({
            title: `${brokerName} 官网候选`,
            url: safeUrl,
            snippet: "搜索服务不可用时生成的官网候选链接，需人工核实。"
          });
        }
      } catch {
        // Ignore malformed generated URLs.
      }
    });
  }

  return hits.slice(0, 3);
};

const searchBing = async (brokerName: string): Promise<SearchHit[]> => {
  const apiKey = getEnvValue("BING_SEARCH_API_KEY");
  if (!apiKey) return [];
  const query = buildSearchQuery(brokerName);
  const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`Bing Search HTTP ${response.status}`);
  const data = (await response.json()) as {
    webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> };
  };
  return (data.webPages?.value ?? [])
    .map((item) => {
      try {
        return {
          title: item.name?.trim() ?? "",
          url: normalizeSafeExternalUrl(item.url ?? ""),
          snippet: item.snippet?.trim() ?? ""
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is SearchHit => Boolean(item?.url))
    .slice(0, MAX_RESULTS);
};

const searchSerpApi = async (brokerName: string): Promise<SearchHit[]> => {
  const apiKey = getEnvValue("SERPAPI_API_KEY");
  if (!apiKey) return [];
  const query = buildSearchQuery(brokerName);
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(MAX_RESULTS));
  const response = await fetch(url, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`SerpAPI HTTP ${response.status}`);
  const data = (await response.json()) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (data.organic_results ?? [])
    .map((item) => {
      try {
        return {
          title: item.title?.trim() ?? "",
          url: normalizeSafeExternalUrl(item.link ?? ""),
          snippet: item.snippet?.trim() ?? ""
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is SearchHit => Boolean(item?.url))
    .slice(0, MAX_RESULTS);
};

const searchTavily = async (brokerName: string): Promise<SearchHit[]> => {
  const apiKey = getEnvValue("TAVILY_API_KEY");
  if (!apiKey) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: buildSearchQuery(brokerName),
      search_depth: "basic",
      max_results: MAX_RESULTS,
      include_answer: false
    })
  });
  if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? [])
    .map((item) => {
      try {
        return {
          title: item.title?.trim() ?? "",
          url: normalizeSafeExternalUrl(item.url ?? ""),
          snippet: item.content?.trim() ?? ""
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is SearchHit => Boolean(item?.url))
    .slice(0, MAX_RESULTS);
};

const searchDuckDuckGo = async (brokerName: string): Promise<SearchHit[]> => {
  const query = buildSearchQuery(brokerName);
  const html = await fetchText(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, SEARCH_TIMEOUT_MS);
  const hits: SearchHit[] = [];
  const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(resultPattern)) {
    try {
      const url = normalizeSearchUrl(match[1] ?? "");
      if (hits.some((hit) => hit.url === url)) continue;
      hits.push({
        url,
        title: stripHtml(match[2] ?? ""),
        snippet: stripHtml(match[3] ?? "")
      });
      if (hits.length >= MAX_RESULTS) break;
    } catch {
      // Skip malformed or blocked URLs from the search page.
    }
  }

  return hits;
};

const searchWeb = async (brokerName: string): Promise<SearchResult> => {
  const providerAttempts: Array<[SearchProviderName, () => Promise<SearchHit[]>]> = [
    ["bing", () => searchBing(brokerName)],
    ["serpapi", () => searchSerpApi(brokerName)],
    ["tavily", () => searchTavily(brokerName)],
    ["duckduckgo", () => searchDuckDuckGo(brokerName)]
  ];
  const warnings: string[] = [];

  for (const [provider, run] of providerAttempts) {
    const configured =
      provider === "duckduckgo" ||
      (provider === "bing" && Boolean(getEnvValue("BING_SEARCH_API_KEY"))) ||
      (provider === "serpapi" && Boolean(getEnvValue("SERPAPI_API_KEY"))) ||
      (provider === "tavily" && Boolean(getEnvValue("TAVILY_API_KEY")));
    if (!configured) continue;

    try {
      const hits = await run();
      if (hits.length) {
        if (provider === "duckduckgo") {
          warnings.push("当前使用 DuckDuckGo HTML 兜底搜索，稳定性低于 Bing/SerpAPI/Tavily 等正式搜索 API。");
        }
        return { provider, hits, warnings };
      }
      warnings.push(`${provider} 没有返回可用搜索结果。`);
    } catch (error) {
      warnings.push(`${provider} 搜索失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const directHits = buildDirectCandidateHits(brokerName);
  if (directHits.length) {
    warnings.push("搜索服务暂不可用，已改用官网候选链接直接抓取；这些链接不代表已确认官网。");
    return { provider: "direct", hits: directHits, warnings };
  }

  warnings.push("搜索服务暂不可用，且无法根据输入生成官网候选链接。");
  return { provider: "manual", hits: [], warnings };
};

const fetchPages = async (hits: SearchHit[]): Promise<FetchedPage[]> => {
  const pages: FetchedPage[] = [];
  for (const hit of hits) {
    try {
      const html = await fetchText(hit.url, PAGE_TIMEOUT_MS);
      pages.push({ ...hit, text: stripHtml(html).slice(0, MAX_PAGE_CHARS), status: "fetched" });
    } catch {
      pages.push({ ...hit, text: `${hit.title} ${hit.snippet}`, status: "failed" });
    }
  }
  return pages;
};

const getOfficialWebsite = (brokerName: string, hits: SearchHit[]) => {
  const normalizedName = brokerName.toLowerCase().replace(/\s+/g, "");
  const blockedHosts = ["facebook.com", "linkedin.com", "youtube.com", "x.com", "twitter.com", "wikifx", "trustpilot", "forexpeacearmy"];
  return (
    hits.find((hit) => {
      const parsed = new URL(hit.url);
      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      if (blockedHosts.some((blocked) => host.includes(blocked))) return false;
      return host.replace(/[^a-z0-9]/g, "").includes(normalizedName.slice(0, Math.min(normalizedName.length, 8)));
    })?.url ?? hits[0]?.url ?? ""
  );
};

const findFirstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
};

const excerptAround = (text: string, needle: string) => {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text.slice(0, 220);
  return text.slice(Math.max(0, index - 100), Math.min(text.length, index + 180)).trim();
};

const addEvidence = (
  evidence: ResearchFieldEvidence[],
  field: BrokerDraftDataField,
  value: string,
  page: FetchedPage | undefined,
  needle = value,
  confidence = 65
) => {
  if (!page || !value) return;
  evidence.push({
    field,
    value,
    sourceUrl: page.url,
    excerpt: excerptAround(page.text, needle),
    confidence,
    sourceTitle: page.title
  });
};

const findPageWith = (pages: FetchedPage[], terms: string[]) =>
  pages.find((page) => terms.some((term) => page.text.toLowerCase().includes(term.toLowerCase())));

const detectRegulators = (combined: string) => {
  const regulatorPatterns: Array<[string, RegExp]> = [
    ["FCA", /\b(FCA|Financial Conduct Authority)\b/i],
    ["ASIC", /\b(ASIC|Australian Securities and Investments Commission)\b/i],
    ["CySEC", /\b(CySEC|Cyprus Securities and Exchange Commission)\b/i],
    ["NFA", /\b(NFA|National Futures Association)\b/i],
    ["CFTC", /\b(CFTC|Commodity Futures Trading Commission)\b/i],
    ["MAS", /\b(MAS|Monetary Authority of Singapore)\b/i],
    ["DFSA", /\b(DFSA|Dubai Financial Services Authority)\b/i],
    ["FSCA", /\b(FSCA|Financial Sector Conduct Authority)\b/i],
    ["FMA", /\b(FMA|Financial Markets Authority)\b/i],
    ["CIRO", /\b(CIRO|IIROC|Canadian Investment Regulatory Organization)\b/i],
    ["BaFin", /\b(BaFin|Federal Financial Supervisory Authority)\b/i],
    ["FINMA", /\b(FINMA|Swiss Financial Market Supervisory Authority)\b/i],
    ["FSA", /\b(FSA|Financial Services Authority Seychelles|Seychelles FSA)\b/i],
    ["VFSC", /\b(VFSC|Vanuatu Financial Services Commission)\b/i],
    ["FSC", /\b(FSC|Financial Services Commission)\b/i]
  ];

  return uniqueList(regulatorPatterns.filter(([, pattern]) => pattern.test(combined)).map(([label]) => label));
};

const tierFromRegulators = (regulators: string[], combined: string): RegulationTier => {
  if (/\b(unregulated|not regulated|no regulation|without regulation)\b/i.test(combined)) return "Unregulated";
  if (regulators.some((item) => ["FCA", "ASIC", "NFA", "CFTC", "MAS", "FINMA", "BaFin", "CIRO"].includes(item))) return "Tier 1";
  if (regulators.some((item) => ["CySEC", "DFSA", "FSCA", "FMA"].includes(item))) return "Tier 2";
  if (regulators.some((item) => ["FSA", "VFSC", "FSC"].includes(item))) return "Tier 3";
  return "Unknown";
};

const detectCountry = (combined: string) => {
  const countries = [
    "United Kingdom",
    "Australia",
    "Cyprus",
    "United States",
    "Singapore",
    "Seychelles",
    "Vanuatu",
    "South Africa",
    "New Zealand",
    "Canada",
    "Switzerland",
    "Germany"
  ];
  return countries.find((country) => new RegExp(`\\b${country}\\b`, "i").test(combined)) ?? "";
};

const detectPlatforms = (combined: string) => {
  const platforms: string[] = [];
  if (/\bMT4\b|MetaTrader 4/i.test(combined)) platforms.push("MT4");
  if (/\bMT5\b|MetaTrader 5/i.test(combined)) platforms.push("MT5");
  if (/cTrader/i.test(combined)) platforms.push("cTrader");
  if (/TradingView/i.test(combined)) platforms.push("TradingView");
  if (/WebTrader|web platform|web trading/i.test(combined)) platforms.push("Web");
  if (/mobile app|iOS|Android/i.test(combined)) platforms.push("移动端");
  if (/\bAPI\b|FIX API/i.test(combined)) platforms.push("API");
  return uniqueList(platforms);
};

const detectAssets = (combined: string) => {
  const assets: string[] = [];
  if (/forex|currency pairs|外汇/i.test(combined)) assets.push("外汇");
  if (/indices|index CFD/i.test(combined)) assets.push("指数 CFD");
  if (/commodities|oil|energy/i.test(combined)) assets.push("大宗商品");
  if (/metals|gold|silver/i.test(combined)) assets.push("贵金属");
  if (/crypto|cryptocurrency/i.test(combined)) assets.push("加密资产 CFD");
  if (/shares|stocks|equities/i.test(combined)) assets.push("股票 CFD");
  return uniqueList(assets);
};

const detectFunding = (combined: string) => {
  const methods: string[] = [];
  if (/bank transfer|wire transfer|银行/i.test(combined)) methods.push("银行转账");
  if (/visa|mastercard|credit card|debit card|银行卡/i.test(combined)) methods.push("银行卡");
  if (/skrill|neteller|e-?wallet|电子钱包/i.test(combined)) methods.push("电子钱包");
  if (/paypal/i.test(combined)) methods.push("PayPal");
  if (/crypto|bitcoin|usdt/i.test(combined)) methods.push("加密货币转账");
  return uniqueList(methods);
};

const detectSupport = (combined: string) => {
  const support: string[] = [];
  if (/24\/5|24-5|24 hours a day, 5 days/i.test(combined)) support.push("24/5");
  if (/24\/7|24-7/i.test(combined)) support.push("24/7");
  if (/live chat|在线客服|chat support/i.test(combined)) support.push("在线客服");
  if (/email|e-mail|邮件/i.test(combined)) support.push("邮件");
  if (/phone|telephone|电话/i.test(combined)) support.push("电话");
  if (/中文|Chinese|Simplified Chinese/i.test(combined)) support.push("中文客服");
  return uniqueList(support);
};

const detectSpread = (combined: string) => {
  const eurUsdWindow = findFirstMatch(combined, [/EUR\/USD.{0,120}?(?:from|as low as|average)?\s*(\d+(?:\.\d+)?)\s*(?:pip|pips)/i]);
  const genericWindow = findFirstMatch(combined, [/(?:spread|spreads).{0,80}?(?:from|as low as)\s*(\d+(?:\.\d+)?)\s*(?:pip|pips)/i]);
  const raw = eurUsdWindow?.[1] ?? genericWindow?.[1];
  return raw ? Number(raw) : null;
};

const detectMinDeposit = (combined: string) => {
  const match = findFirstMatch(combined, [
    /minimum deposit.{0,80}?(?:USD|US\$|\$|€|EUR|£|GBP)?\s*([0-9][0-9,]*(?:\.\d+)?)/i,
    /min\.?\s*deposit.{0,80}?(?:USD|US\$|\$|€|EUR|£|GBP)?\s*([0-9][0-9,]*(?:\.\d+)?)/i
  ]);
  return match?.[1] ? Number(match[1].replace(/,/g, "")) : null;
};

const detectCommission = (combined: string) => {
  const match = findFirstMatch(combined, [/commission.{0,120}?(?:\$|USD|US\$|€|EUR)?\s*[0-9][^.;]{0,80}/i]);
  return match?.[0]?.trim() ?? "";
};

const detectLeverage = (combined: string) => {
  const match = findFirstMatch(combined, [/leverage.{0,80}?(1:\s?\d+)/i, /(1:\s?\d+).{0,80}?leverage/i]);
  return match?.[1]?.replace(/\s+/g, "") ?? "";
};

const detectBooleanSignal = (combined: string, positivePatterns: RegExp[], negativePatterns: RegExp[]) => {
  if (negativePatterns.some((pattern) => pattern.test(combined))) return { detected: true, value: false };
  if (positivePatterns.some((pattern) => pattern.test(combined))) return { detected: true, value: true };
  return { detected: false, value: false };
};

const pushImportedField = (fields: BrokerDraftDataField[], field: BrokerDraftDataField, shouldInclude: boolean) => {
  if (shouldInclude && !fields.includes(field)) fields.push(field);
};

const normalizeProviderName = (provider: SearchProviderName | "cloud") => {
  const labels: Record<SearchProviderName | "cloud", string> = {
    cloud: "云端 Research API",
    bing: "Bing Search API",
    serpapi: "SerpAPI",
    tavily: "Tavily",
    duckduckgo: "DuckDuckGo HTML 兜底",
    direct: "官网候选直连兜底",
    manual: "手动补充草稿"
  };
  return labels[provider] ?? provider;
};

const finalizeResearchResult = (
  result: Omit<BrokerResearchResult, "dataCompleteness" | "averageConfidence" | "requiresReview">,
  minCompleteness = 55,
  overrides?: Partial<Pick<BrokerResearchResult, "dataCompleteness" | "averageConfidence">>
): BrokerResearchResult => {
  const dataCompleteness = overrides?.dataCompleteness ?? calculateResearchCompleteness(result.brokerDraft, result.evidence, result.sources);
  const averageConfidence = overrides?.averageConfidence ?? calculateAverageEvidenceConfidence(result.evidence, dataCompleteness);
  const requiresReview = dataCompleteness < minCompleteness || averageConfidence < 60 || result.evidence.length === 0;
  return {
    ...result,
    dataCompleteness,
    averageConfidence,
    requiresReview
  };
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");
const getNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const getStringArray = (value: unknown) => (Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : []);

const inferImportedFields = (draft: BrokerDraft): BrokerDraftDataField[] => {
  const fields: BrokerDraftDataField[] = ["name", "notes", "lastUpdated"];
  (Object.keys(draft) as Array<keyof BrokerDraft>).forEach((field) => {
    if (field === "id" || field === "isMock" || field === "importedFields") return;
    const value = draft[field];
    const hasValue = Array.isArray(value)
      ? value.length > 0
      : typeof value === "string"
        ? value.trim() !== "" && value !== "Unknown"
        : typeof value === "number"
          ? Number.isFinite(value)
          : typeof value === "boolean"
            ? value
            : value !== null && value !== undefined;
    if (hasValue && !fields.includes(field as BrokerDraftDataField)) fields.push(field as BrokerDraftDataField);
  });
  return fields;
};

const normalizeRemoteResearchResult = (
  cleanedName: string,
  payload: Record<string, unknown>,
  minCompleteness: number
): BrokerResearchResult => {
  const rawDraft = (payload.brokerDraft && typeof payload.brokerDraft === "object" ? payload.brokerDraft : {}) as Partial<BrokerDraft> & Record<string, unknown>;
  const rawSources = Array.isArray(payload.sources) ? (payload.sources as Array<Record<string, unknown>>) : [];
  const rawEvidence = Array.isArray(payload.evidence) ? (payload.evidence as Array<Record<string, unknown>>) : [];

  const sourceUrlsFromSources = rawSources
    .map((source) => {
      try {
        return normalizeSafeExternalUrl(getString(source.url));
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  const draft = normalizeBrokerDraft({
    ...rawDraft,
    name: getString(rawDraft.name) || cleanedName,
    regulators: getStringArray(rawDraft.regulators),
    tradingPlatforms: getStringArray(rawDraft.tradingPlatforms),
    assets: getStringArray(rawDraft.assets),
    depositWithdrawMethods: getStringArray(rawDraft.depositWithdrawMethods),
    customerSupport: getStringArray(rawDraft.customerSupport),
    sourceUrls: uniqueList([...getStringArray(rawDraft.sourceUrls), ...sourceUrlsFromSources]),
    notes:
      getString(rawDraft.notes) ||
      "云端 Research API 返回的候选结果，尚未人工核实；不构成投资建议，需要用户自行前往平台官网和监管机构官网确认。",
    lastUpdated: getString(rawDraft.lastUpdated) || new Date().toISOString().slice(0, 10),
    importedFields: getStringArray(rawDraft.importedFields) as BrokerDraftDataField[]
  });
  if (!draft.importedFields?.length) draft.importedFields = inferImportedFields(draft);

  const sources: ResearchSource[] = rawSources
    .map((source) => {
      try {
        const status = getString(source.status);
        return {
          title: getString(source.title),
          url: normalizeSafeExternalUrl(getString(source.url)),
          snippet: getString(source.snippet),
          status: status === "fetched" || status === "failed" || status === "searched" ? status : "searched"
        } satisfies ResearchSource;
      } catch {
        return null;
      }
    })
    .filter((source): source is ResearchSource => Boolean(source));

  const evidence: ResearchFieldEvidence[] = rawEvidence
    .map((item): ResearchFieldEvidence | null => {
      try {
        const field = getString(item.field) as BrokerDraftDataField;
        if (!field || !(field in draft)) return null;
        const confidence = getNumber(item.confidence);
        const sourceTitle = getString(item.sourceTitle);
        return {
          field,
          value: getString(item.value),
          sourceUrl: normalizeSafeExternalUrl(getString(item.sourceUrl)),
          excerpt: getString(item.excerpt),
          ...(typeof confidence === "number" ? { confidence } : {}),
          ...(sourceTitle ? { sourceTitle } : {})
        } satisfies ResearchFieldEvidence;
      } catch {
        return null;
      }
    })
    .filter((item): item is ResearchFieldEvidence => Boolean(item));

  return finalizeResearchResult(
    {
      query: getString(payload.query) || cleanedName,
      brokerDraft: draft,
      sources,
      evidence,
      warnings: getStringArray(payload.warnings),
      searchedAt: getString(payload.searchedAt) || new Date().toISOString(),
      researchProvider: getString(payload.researchProvider) || normalizeProviderName("cloud")
    },
    minCompleteness,
    {
      dataCompleteness: getNumber(payload.dataCompleteness),
      averageConfidence: getNumber(payload.averageConfidence)
    }
  );
};

const researchWithCloudApi = async (cleanedName: string, settings?: AppSettings): Promise<BrokerResearchResult | null> => {
  if (!settings?.useCloudResearchApi || !settings.researchApiEndpoint.trim()) return null;
  const endpoint = normalizeSafeExternalUrl(settings.researchApiEndpoint.trim());
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(settings.researchApiToken.trim() ? { authorization: `Bearer ${settings.researchApiToken.trim()}` } : {})
    },
    body: JSON.stringify({
      query: cleanedName,
      locale: "zh-CN",
      product: "Forex Platform Finder",
      schemaVersion: 1,
      requirements: [
        "return brokerDraft with importedFields",
        "return field-level evidence with sourceUrl/excerpt/confidence",
        "do not provide investment advice",
        "mark all extracted data as candidates requiring user verification"
      ]
    })
  });
  if (!response.ok) throw new Error(`Research API HTTP ${response.status}`);
  const payload = (await response.json()) as Record<string, unknown>;
  return normalizeRemoteResearchResult(cleanedName, payload, settings.minResearchCompleteness);
};

export const buildBrokerResearchResult = (
  cleanedName: string,
  hits: SearchHit[],
  pages: FetchedPage[],
  provider: SearchProviderName,
  providerWarnings: string[] = [],
  minCompleteness = 55
): BrokerResearchResult => {
  const warnings: string[] = [];
  warnings.push(...providerWarnings);

  const combined = pages.map((page) => `${page.title}. ${page.snippet}. ${page.text}`).join("\n\n");
  const regulators = detectRegulators(combined);
  const regulationTier = tierFromRegulators(regulators, combined);
  const tradingPlatforms = detectPlatforms(combined);
  const customerSupport = detectSupport(combined);
  const funding = detectFunding(combined);
  const assets = detectAssets(combined);
  const sourceUrls = uniqueList(pages.map((page) => page.url));
  const website = getOfficialWebsite(cleanedName, hits);
  const country = detectCountry(combined);
  const spread = detectSpread(combined);
  const commission = detectCommission(combined);
  const minDeposit = detectMinDeposit(combined);
  const leverage = detectLeverage(combined);
  const educationResources = /education|academy|webinar|tutorial|教育/i.test(combined) ? "联网文本显示可能提供教育资源，需自行核实。" : "";
  const fundSegregation = detectBooleanSignal(
    combined,
    [/segregated client funds|client funds are segregated|segregated accounts|资金隔离/i],
    [/not segregated|no segregated client funds|client funds are not segregated|do not segregate/i]
  );
  const negativeBalanceProtection = detectBooleanSignal(
    combined,
    [/negative balance protection|负余额保护/i],
    [/no negative balance protection|without negative balance protection|does not offer negative balance protection/i]
  );
  const chineseSupport = detectBooleanSignal(
    combined,
    [/中文|Chinese|Simplified Chinese/i],
    [/Chinese (?:is )?not available|does not support Chinese|no Chinese support/i]
  );
  const apiSupport = detectBooleanSignal(
    combined,
    [/\bAPI\b|FIX API/i],
    [/no API|API (?:is )?not available|does not offer API/i]
  );
  const importedFields: BrokerDraftDataField[] = ["name", "notes", "lastUpdated"];

  if (pages.every((page) => page.status !== "fetched")) warnings.push("搜索结果可用，但网页正文抓取失败，字段准确性较低。");
  if (regulationTier === "Unknown") warnings.push("未能可靠识别监管等级，请手动核实监管机构官网。");
  if (regulationTier === "Unregulated") warnings.push("搜索文本包含未受监管相关描述，必须重点核实。");
  if (!spread) warnings.push("未能可靠识别 EUR/USD 平均点差。");
  if (!sourceUrls.length) warnings.push("没有可保存的来源链接。");
  if (provider === "duckduckgo") warnings.push("建议配置 Bing/SerpAPI/Tavily 等正式搜索 API 后再用于稳定批量更新。");
  if (provider === "direct") warnings.push("本次结果来自直接官网候选抓取，不是搜索引擎结果；请先确认链接是否为平台官网。");
  if (provider === "manual") warnings.push("本次没有可抓取来源，已生成空白研究草稿供人工补充；不会自动声称平台安全。");

  pushImportedField(importedFields, "website", Boolean(website));
  pushImportedField(importedFields, "country", Boolean(country));
  pushImportedField(importedFields, "regulators", regulators.length > 0);
  pushImportedField(importedFields, "regulationTier", regulationTier !== "Unknown");
  pushImportedField(importedFields, "fundSegregation", fundSegregation.detected);
  pushImportedField(importedFields, "negativeBalanceProtection", negativeBalanceProtection.detected);
  pushImportedField(importedFields, "avgSpreadEurUsd", spread !== null);
  pushImportedField(importedFields, "commission", Boolean(commission));
  pushImportedField(importedFields, "minDeposit", minDeposit !== null);
  pushImportedField(importedFields, "maxLeverage", Boolean(leverage));
  pushImportedField(importedFields, "tradingPlatforms", tradingPlatforms.length > 0);
  pushImportedField(importedFields, "assets", assets.length > 0);
  pushImportedField(importedFields, "depositWithdrawMethods", funding.length > 0);
  pushImportedField(importedFields, "chineseSupport", chineseSupport.detected);
  pushImportedField(importedFields, "customerSupport", customerSupport.length > 0);
  pushImportedField(importedFields, "educationResources", Boolean(educationResources));
  pushImportedField(importedFields, "apiSupport", apiSupport.detected);
  pushImportedField(importedFields, "sourceUrls", sourceUrls.length > 0);

  const draft: BrokerDraft = normalizeBrokerDraft({
    name: cleanedName,
    website,
    country,
    regulators,
    regulationTier,
    fundSegregation: fundSegregation.value,
    negativeBalanceProtection: negativeBalanceProtection.value,
    avgSpreadEurUsd: spread,
    commission,
    minDeposit,
    maxLeverage: leverage,
    tradingPlatforms,
    assets,
    depositWithdrawMethods: funding,
    chineseSupport: chineseSupport.value,
    customerSupport,
    educationResources,
    apiSupport: apiSupport.value,
    notes: "联网研究候选结果，尚未人工核实；不构成投资建议，需要用户自行前往平台官网和监管机构官网确认。",
    sourceUrls,
    lastUpdated: new Date().toISOString().slice(0, 10),
    importedFields
  });

  const evidence: ResearchFieldEvidence[] = [];
  regulators.forEach((regulator) => addEvidence(evidence, "regulators", regulator, findPageWith(pages, [regulator]), regulator));
  addEvidence(evidence, "regulationTier", draft.regulationTier, findPageWith(pages, regulators.length ? regulators : ["regulated", "unregulated"]));
  if (draft.avgSpreadEurUsd !== null) addEvidence(evidence, "avgSpreadEurUsd", String(draft.avgSpreadEurUsd), findPageWith(pages, ["EUR/USD", "spread"]));
  if (draft.minDeposit !== null) addEvidence(evidence, "minDeposit", String(draft.minDeposit), findPageWith(pages, ["minimum deposit", "min deposit"]));
  if (fundSegregation.detected) addEvidence(evidence, "fundSegregation", fundSegregation.value ? "是" : "否", findPageWith(pages, ["segregated", "资金隔离"]));
  if (negativeBalanceProtection.detected) addEvidence(evidence, "negativeBalanceProtection", negativeBalanceProtection.value ? "是" : "否", findPageWith(pages, ["negative balance", "负余额"]));
  if (chineseSupport.detected) addEvidence(evidence, "chineseSupport", chineseSupport.value ? "是" : "否", findPageWith(pages, ["Chinese", "中文"]));
  if (apiSupport.detected) addEvidence(evidence, "apiSupport", apiSupport.value ? "是" : "否", findPageWith(pages, ["API", "FIX API"]));
  draft.tradingPlatforms.forEach((platform) => addEvidence(evidence, "tradingPlatforms", platform, findPageWith(pages, [platform])));
  draft.depositWithdrawMethods.forEach((method) => addEvidence(evidence, "depositWithdrawMethods", method, findPageWith(pages, [method])));

  return finalizeResearchResult(
    {
    query: cleanedName,
    brokerDraft: draft,
    sources: pages.map((page) => ({
      title: page.title,
      url: page.url,
      snippet: page.snippet,
      status: page.status
    })),
    evidence,
    warnings,
      searchedAt: new Date().toISOString(),
      researchProvider: normalizeProviderName(provider)
    },
    minCompleteness
  );
};

export const researchBrokerFromWeb = async (brokerName: string, settings?: AppSettings): Promise<BrokerResearchResult> => {
  const cleanedName = brokerName.trim();
  ensureResearchQueryIsSpecific(cleanedName);
  const minCompleteness = settings?.minResearchCompleteness ?? 55;
  const cloudWarnings: string[] = [];

  try {
    const cloudResult = await researchWithCloudApi(cleanedName, settings);
    if (cloudResult) return cloudResult;
  } catch (error) {
    cloudWarnings.push(`云端 Research API 调用失败，已退回本地研究：${error instanceof Error ? error.message : String(error)}`);
  }

  const search = await searchWeb(cleanedName);
  if (search.hits.length === 0) {
    return buildBrokerResearchResult(cleanedName, [], [], search.provider, [...cloudWarnings, ...search.warnings], minCompleteness);
  }

  const pages = await fetchPages(search.hits);
  return buildBrokerResearchResult(cleanedName, search.hits, pages, search.provider, [...cloudWarnings, ...search.warnings], minCompleteness);
};
