import { ArrowUpRight, CalendarClock, Gauge, ShieldCheck, Star, Users } from "lucide-react";
import type { ComponentType } from "react";
import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { RiskBadge } from "../components/RiskBadge";
import { ScoreMeter } from "../components/ScoreMeter";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import type { AppSettings, Broker } from "../types/broker";

interface DashboardPageProps {
  brokers: Broker[];
  settings: AppSettings;
  onOpenBroker: (id: string) => void;
}

const MetricCard = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: ComponentType<{ className?: string }> }) => (
  <Card>
    <CardContent className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
    </CardContent>
  </Card>
);

export const DashboardPage = ({ brokers, settings, onOpenBroker }: DashboardPageProps) => {
  const highScoreCount = brokers.filter((broker) => broker.score >= settings.highScoreThreshold).length;
  const regulatedCount = brokers.filter((broker) => ["Tier 1", "Tier 2", "Tier 3"].includes(broker.regulationTier)).length;
  const averageScore = brokers.length ? brokers.reduce((sum, broker) => sum + broker.score, 0) / brokers.length : 0;
  const latestUpdated = brokers.map((broker) => broker.lastUpdated).filter(Boolean).sort().at(-1) ?? "-";
  const topBrokers = [...brokers].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">本地外汇平台研究数据库，所有信息均需自行核实。</p>
      </div>

      <DisclaimerBanner />

      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="平台总数" value={brokers.length} icon={Users} />
        <MetricCard label="高分平台数量" value={highScoreCount} icon={Star} />
        <MetricCard label="监管合规平台数量" value={regulatedCount} icon={ShieldCheck} />
        <MetricCard label="平均评分" value={averageScore.toFixed(1)} icon={Gauge} />
        <MetricCard label="最近更新时间" value={latestUpdated} icon={CalendarClock} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Top 5 平台</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">示例数据非实时排名，非投资建议，需要用户自行核实。</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">平台</th>
                  <th className="px-3 py-2">国家或地区</th>
                  <th className="px-3 py-2">监管等级</th>
                  <th className="px-3 py-2">综合评分</th>
                  <th className="px-3 py-2">风险等级</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {topBrokers.map((broker) => (
                  <tr key={broker.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{broker.name}</td>
                    <td className="px-3 py-3">{broker.country || "-"}</td>
                    <td className="px-3 py-3">{broker.regulationTier}</td>
                    <td className="px-3 py-3">
                      <ScoreMeter score={broker.score} />
                    </td>
                    <td className="px-3 py-3">
                      <RiskBadge riskLevel={broker.riskLevel} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => onOpenBroker(broker.id)}>
                        详情
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
