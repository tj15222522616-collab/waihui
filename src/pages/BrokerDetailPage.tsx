import { ArrowLeft, Edit, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { RiskBadge } from "../components/RiskBadge";
import { ScoreMeter } from "../components/ScoreMeter";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { forexApi } from "../services/forexApi";
import type { Broker, BrokerSource, ScoreHistoryEntry } from "../types/broker";

interface BrokerDetailPageProps {
  broker: Broker | null;
  onEdit: (id: string) => void;
  onBack: () => void;
}

const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-border py-2 text-sm last:border-0">
    <dt className="text-muted-foreground">{label}</dt>
    <dd>{value || "-"}</dd>
  </div>
);

const join = (items: string[]) => (items.length ? items.join(", ") : "-");

export const BrokerDetailPage = ({ broker, onEdit, onBack }: BrokerDetailPageProps) => {
  const [sources, setSources] = useState<BrokerSource[]>([]);
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);

  useEffect(() => {
    if (!broker) return;
    void Promise.all([forexApi.listSources(broker.id), forexApi.listScoreHistory(broker.id)]).then(([sourceRows, scoreRows]) => {
      setSources(sourceRows);
      setHistory(scoreRows);
    });
  }, [broker]);

  if (!broker) {
    return (
      <Card>
        <CardContent className="text-muted-foreground">未选择平台，请从列表页选择一个平台。</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" className="mb-2 px-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回列表
          </Button>
          <h1 className="text-2xl font-semibold">{broker.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">完整详情、评分解释和风险提示。</p>
        </div>
        <Button onClick={() => onEdit(broker.id)}>
          <Edit className="h-4 w-4" aria-hidden="true" />
          编辑
        </Button>
      </div>

      <DisclaimerBanner />

      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>基础信息</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow
                  label="官网"
                  value={
                    broker.website ? (
                      <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => void forexApi.openExternal(broker.website)}>
                        {broker.website}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      "-"
                    )
                  }
                />
                <InfoRow label="国家或地区" value={broker.country} />
                <InfoRow label="更新时间" value={broker.lastUpdated} />
                <InfoRow label="示例数据" value={<Badge tone={broker.isMock ? "warning" : "neutral"}>{broker.isMock ? "示例数据" : "用户数据"}</Badge>} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>监管信息</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="监管机构" value={join(broker.regulators)} />
                <InfoRow label="监管等级" value={broker.regulationTier} />
                <InfoRow label="客户资金隔离" value={broker.fundSegregation ? "是" : "否"} />
                <InfoRow label="负余额保护" value={broker.negativeBalanceProtection ? "是" : "否"} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>费用与交易条件</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="EUR/USD 平均点差" value={broker.avgSpreadEurUsd ?? "未知"} />
                <InfoRow label="佣金" value={broker.commission} />
                <InfoRow label="最低入金" value={broker.minDeposit ?? "未知"} />
                <InfoRow label="最大杠杆" value={broker.maxLeverage} />
                <InfoRow label="支持平台" value={join(broker.tradingPlatforms)} />
                <InfoRow label="可交易品种" value={join(broker.assets)} />
                <InfoRow label="API 支持" value={broker.apiSupport ? "是" : "否"} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>出入金与用户体验</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="出入金方式" value={join(broker.depositWithdrawMethods)} />
                <InfoRow label="中文支持" value={broker.chineseSupport ? "是" : "否"} />
                <InfoRow label="客服渠道" value={join(broker.customerSupport)} />
                <InfoRow label="教育资源" value={broker.educationResources} />
                <InfoRow label="备注" value={broker.notes} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>数据来源</CardTitle>
            </CardHeader>
            <CardContent>
              {sources.length ? (
                <ul className="space-y-2 text-sm">
                  {sources.map((source) => (
                    <li key={source.id}>
                      <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => void forexApi.openExternal(source.url)}>
                        {source.url}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">暂无来源链接，建议补充后再作为研究依据。</p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>综合评分</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScoreMeter score={broker.score} />
              <RiskBadge riskLevel={broker.riskLevel} />
              <div className="space-y-2 text-sm">
                {Object.entries(broker.scoreBreakdown).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between border-b border-border pb-1 last:border-0">
                    <span className="text-muted-foreground">{breakdownLabel(key)}</span>
                    <span className="font-medium">{value.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>评分解释</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {broker.scoreExplanation.map((item) => (
                  <li key={item} className="rounded-md bg-muted/50 p-2">
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>风险提示</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>本评分是用于筛选“相对值得研究”的信息整理工具，不代表平台安全或适合任何用户。</p>
              <p>请自行核实监管牌照、费用、点差、杠杆、资金隔离、出入金政策和客户协议。</p>
              {broker.regulationTier === "Unregulated" && <p className="font-medium text-danger">该平台标记为未受监管，系统强制至少显示为高风险。</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>评分历史</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length ? (
                <div className="space-y-2 text-sm">
                  {history.slice(0, 6).map((entry) => (
                    <div key={entry.id} className="rounded-md border border-border p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{entry.score.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无评分历史。</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

const breakdownLabel = (key: string) => {
  const labels: Record<string, string> = {
    regulationSafety: "监管安全",
    tradingCosts: "交易成本",
    fundingConvenience: "出入金便利性",
    platformFeatures: "平台功能",
    customerService: "客户服务",
    transparency: "信息透明度"
  };
  return labels[key] ?? key;
};
