import { Edit, Eye, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RiskBadge } from "../components/RiskBadge";
import { ScoreMeter } from "../components/ScoreMeter";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { forexApi } from "../services/forexApi";
import { applyBrokerFilters, defaultBrokerFilters } from "../services/filterBrokers";
import type { AppSettings, Broker, BrokerFilters, RiskLevel } from "../types/broker";
import { regulationTiers, riskLevelLabels, riskLevels } from "../types/broker";

interface BrokersPageProps {
  brokers: Broker[];
  settings: AppSettings;
  globalSearch: string;
  onOpenBroker: (id: string) => void;
  onEditBroker: (id: string) => void;
  onRefresh: () => Promise<void>;
}

const listText = (items: string[]) => (items.length ? items.join(", ") : "-");

export const BrokersPage = ({ brokers, settings, globalSearch, onOpenBroker, onEditBroker, onRefresh }: BrokersPageProps) => {
  const [filters, setFilters] = useState<BrokerFilters>(defaultBrokerFilters(settings));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setFilters((current) => ({ ...current, sortBy: settings.defaultSortField }));
  }, [settings.defaultSortField]);

  const filteredBrokers = useMemo(() => {
    return applyBrokerFilters(
      brokers,
      {
        ...filters,
        search: [globalSearch, filters.search].filter(Boolean).join(" ")
      },
      settings
    );
  }, [brokers, filters, globalSearch, settings]);

  const updateFilter = <K extends keyof BrokerFilters>(key: K, value: BrokerFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const deleteBroker = async (broker: Broker) => {
    if (!confirm(`确认删除「${broker.name}」？此操作会从本地数据库移除该平台。`)) return;
    await forexApi.deleteBroker(broker.id);
    setMessage(`已删除 ${broker.name}`);
    await onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Brokers</h1>
          <p className="mt-1 text-sm text-muted-foreground">筛选、排序和管理外汇平台研究资料。</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          当前显示 <span className="font-semibold text-foreground">{filteredBrokers.length}</span> / {brokers.length}
        </div>
      </div>

      {message && <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{message}</div>}

      <Card>
        <CardHeader>
          <CardTitle>筛选器</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-3">
            <Input placeholder="页内搜索" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
            <Select value={filters.regulationTier} onChange={(event) => updateFilter("regulationTier", event.target.value as BrokerFilters["regulationTier"])}>
              <option value="All">全部监管等级</option>
              {regulationTiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </Select>
            <Select value={filters.chineseSupport} onChange={(event) => updateFilter("chineseSupport", event.target.value as BrokerFilters["chineseSupport"])}>
              <option value="All">中文支持</option>
              <option value="Yes">支持中文</option>
              <option value="No">不支持中文</option>
            </Select>
            <Select value={filters.platform} onChange={(event) => updateFilter("platform", event.target.value as BrokerFilters["platform"])}>
              <option value="All">全部平台</option>
              <option value="MT4">支持 MT4</option>
              <option value="MT5">支持 MT5</option>
            </Select>
            <Select value={filters.riskLevel} onChange={(event) => updateFilter("riskLevel", event.target.value as "All" | RiskLevel)}>
              <option value="All">全部风险等级</option>
              {riskLevels.map((risk) => (
                <option key={risk} value={risk}>
                  {riskLevelLabels[risk]}
                </option>
              ))}
            </Select>
            <Select value={filters.sortBy} onChange={(event) => updateFilter("sortBy", event.target.value as BrokerFilters["sortBy"])}>
              <option value="score">按评分排序</option>
              <option value="avgSpreadEurUsd">按点差排序</option>
              <option value="minDeposit">按最低入金排序</option>
              <option value="name">按名称排序</option>
              <option value="lastUpdated">按更新时间排序</option>
            </Select>
            <Select value={filters.sortDirection} onChange={(event) => updateFilter("sortDirection", event.target.value as BrokerFilters["sortDirection"])}>
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="max-w-full overflow-auto">
            <table className="min-w-[1700px] text-left text-sm">
              <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">平台名称</th>
                  <th className="px-3 py-2">官网</th>
                  <th className="px-3 py-2">国家或地区</th>
                  <th className="px-3 py-2">监管机构</th>
                  <th className="px-3 py-2">监管等级</th>
                  <th className="px-3 py-2">资金隔离</th>
                  <th className="px-3 py-2">负余额保护</th>
                  <th className="px-3 py-2">EUR/USD 点差</th>
                  <th className="px-3 py-2">佣金</th>
                  <th className="px-3 py-2">最低入金</th>
                  <th className="px-3 py-2">最大杠杆</th>
                  <th className="px-3 py-2">支持平台</th>
                  <th className="px-3 py-2">中文</th>
                  <th className="px-3 py-2">出入金</th>
                  <th className="px-3 py-2">客服</th>
                  <th className="px-3 py-2">评分</th>
                  <th className="px-3 py-2">风险</th>
                  <th className="px-3 py-2">更新时间</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrokers.map((broker) => (
                  <tr key={broker.id} className="border-t border-border align-top hover:bg-muted/35">
                    <td className="px-3 py-3 font-medium">{broker.name}</td>
                    <td className="max-w-48 truncate px-3 py-3">{broker.website || "-"}</td>
                    <td className="px-3 py-3">{broker.country || "-"}</td>
                    <td className="max-w-56 px-3 py-3">{listText(broker.regulators)}</td>
                    <td className="px-3 py-3">{broker.regulationTier}</td>
                    <td className="px-3 py-3">
                      <Badge tone={broker.fundSegregation ? "success" : "neutral"}>{broker.fundSegregation ? "是" : "否"}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={broker.negativeBalanceProtection ? "success" : "neutral"}>{broker.negativeBalanceProtection ? "是" : "否"}</Badge>
                    </td>
                    <td className="px-3 py-3">{broker.avgSpreadEurUsd ?? "未知"}</td>
                    <td className="max-w-48 px-3 py-3">{broker.commission || "-"}</td>
                    <td className="px-3 py-3">{broker.minDeposit ?? "未知"}</td>
                    <td className="px-3 py-3">{broker.maxLeverage || "-"}</td>
                    <td className="max-w-56 px-3 py-3">{listText(broker.tradingPlatforms)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={broker.chineseSupport ? "success" : "neutral"}>{broker.chineseSupport ? "支持" : "否"}</Badge>
                    </td>
                    <td className="max-w-56 px-3 py-3">{listText(broker.depositWithdrawMethods)}</td>
                    <td className="max-w-48 px-3 py-3">{listText(broker.customerSupport)}</td>
                    <td className="px-3 py-3">
                      <ScoreMeter score={broker.score} />
                    </td>
                    <td className="px-3 py-3">
                      <RiskBadge riskLevel={broker.riskLevel} />
                    </td>
                    <td className="px-3 py-3">{broker.lastUpdated || "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="secondary" title="查看详情" onClick={() => onOpenBroker(broker.id)}>
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button size="icon" variant="secondary" title="编辑" onClick={() => onEditBroker(broker.id)}>
                          <Edit className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button size="icon" variant="ghost" title="删除" onClick={() => void deleteBroker(broker)}>
                          <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBrokers.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={19}>
                      没有匹配的平台。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
