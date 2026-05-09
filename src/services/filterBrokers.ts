import type { AppSettings, Broker, BrokerFilters } from "../types/broker";

const text = (value: unknown) => String(value ?? "").toLowerCase();

export const defaultBrokerFilters = (settings?: AppSettings): BrokerFilters => ({
  search: "",
  regulationTier: "All",
  chineseSupport: "All",
  platform: "All",
  riskLevel: "All",
  sortBy: settings?.defaultSortField ?? "score",
  sortDirection: "desc"
});

export const applyBrokerFilters = (brokers: Broker[], filters: BrokerFilters, settings?: AppSettings) => {
  const query = text(filters.search).trim();
  const filtered = brokers.filter((broker) => {
    if (!settings?.showHighRiskPlatforms && ["HIGH_CAUTION", "EXTREME_AVOID"].includes(broker.riskLevel)) return false;
    if (filters.regulationTier !== "All" && broker.regulationTier !== filters.regulationTier) return false;
    if (filters.chineseSupport !== "All" && broker.chineseSupport !== (filters.chineseSupport === "Yes")) return false;
    if (filters.platform !== "All" && !broker.tradingPlatforms.some((platform) => platform.toLowerCase().includes(filters.platform.toLowerCase()))) return false;
    if (filters.riskLevel !== "All" && broker.riskLevel !== filters.riskLevel) return false;
    if (!query) return true;
    return [
      broker.name,
      broker.website,
      broker.country,
      broker.regulationTier,
      broker.regulators.join(" "),
      broker.tradingPlatforms.join(" "),
      broker.depositWithdrawMethods.join(" "),
      broker.customerSupport.join(" ")
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const direction = filters.sortDirection === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    const field = filters.sortBy;
    if (field === "name") return a.name.localeCompare(b.name) * direction;
    if (field === "lastUpdated") return a.lastUpdated.localeCompare(b.lastUpdated) * direction;
    const aValue = a[field];
    const bValue = b[field];
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    return (Number(aValue) - Number(bValue)) * direction;
  });
};
