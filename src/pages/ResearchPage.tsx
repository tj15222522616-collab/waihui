import { CheckCircle2, ExternalLink, Globe2, Search, ShieldAlert } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { RiskBadge } from "../components/RiskBadge";
import { ScoreMeter } from "../components/ScoreMeter";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { calculateBrokerScore } from "../scoring/calculateBrokerScore";
import { forexApi } from "../services/forexApi";
import type { AppSettings, BrokerDraftDataField, BrokerResearchResult, BrokerScore, RuntimeInfo } from "../types/broker";

interface ResearchPageProps {
  settings: AppSettings;
  onSaved: () => Promise<void>;
  onOpenBroker: (id: string) => void;
}

const listText = (items: string[]) => (items.length ? items.join(", ") : "未识别");

const isSpecificResearchQuery = (value: string) => {
  const cleaned = value.trim();
  return cleaned.length >= 3 || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned);
};

const FieldRow = ({ label, value, recognized = true }: { label: string; value: string | number | null | boolean | string[]; recognized?: boolean }) => {
  const display = !recognized ? "未识别" : Array.isArray(value) ? listText(value) : typeof value === "boolean" ? (value ? "是" : "否") : value ?? "未识别";
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{display || "未识别"}</span>
    </div>
  );
};

export const ResearchPage = ({ settings, onSaved, onOpenBroker }: ResearchPageProps) => {
  const [brokerName, setBrokerName] = useState("");
  const [result, setResult] = useState<BrokerResearchResult | null>(null);
  const [score, setScore] = useState<BrokerScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);

  const fetchedCount = useMemo(() => result?.sources.filter((source) => source.status === "fetched").length ?? 0, [result]);

  useEffect(() => {
    void forexApi.getRuntimeInfo().then(setRuntimeInfo).catch(() => {
      setRuntimeInfo({
        mode: "browser-preview",
        realWebResearch: false,
        message: "无法确认当前运行环境。若在浏览器预览中测试，联网研究不会访问真实搜索引擎。",
        searchProviders: []
      });
    });
  }, []);

  const runResearch = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    setSavedMessage(null);
    setResult(null);
    setScore(null);
    if (!brokerName.trim()) {
      setError("请输入平台名称。");
      return;
    }
    if (!isSpecificResearchQuery(brokerName)) {
      setError("输入过短，无法可靠联网研究。请输入更完整的平台名称或官网域名，例如 Example Markets 或 example.com。");
      return;
    }

    setLoading(true);
    try {
      const research = await forexApi.researchBroker(brokerName);
      setResult(research);
      setScore(calculateBrokerScore(research.brokerDraft, settings.scoringWeights));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const saveResult = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await forexApi.saveResearchResult(result.brokerDraft);
      await onSaved();
      setSavedMessage(`已保存研究结果：${saved.name}`);
      onOpenBroker(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const hasRecognizedField = (field: BrokerDraftDataField) => {
    const importedFields = result?.brokerDraft.importedFields;
    return !importedFields || importedFields.includes(field);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">联网研究平台</h1>
        <p className="mt-1 text-sm text-muted-foreground">输入平台名称，系统会联网搜索来源、抽取候选字段、生成评分。保存前请人工核实证据。</p>
      </div>

      <DisclaimerBanner />

      {runtimeInfo && !runtimeInfo.realWebResearch && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {runtimeInfo.message}
        </div>
      )}
      {runtimeInfo?.realWebResearch && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
          {runtimeInfo.message} 可用搜索源：{runtimeInfo.searchProviders.join("、")}。
        </div>
      )}

      <Card>
        <CardContent>
          <form className="flex gap-3" onSubmit={(event) => void runResearch(event)}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="pl-9" value={brokerName} onChange={(event) => setBrokerName(event.target.value)} placeholder="输入完整平台名称或官网域名，例如 Example Markets / example.com" />
            </div>
            <Button type="submit" disabled={loading}>
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              {loading ? "联网研究中..." : "开始联网研究"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      {savedMessage && <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{savedMessage}</div>}

      {result && score && (
        <div className="grid grid-cols-[1fr_380px] gap-5">
          <div className="space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>候选资料</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">这些字段来自自动搜索和规则抽取，不是已核实结论。</p>
                </div>
                <Button onClick={() => void saveResult()} disabled={saving}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {saving ? "保存中..." : result.requiresReview ? "保存待复核结果" : "确认保存研究结果"}
                </Button>
              </CardHeader>
              <CardContent>
                {result.requiresReview && (
                  <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                    资料完整度或证据置信度不足，建议作为待复核草稿保存，不要作为已核实结论。
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <FieldRow label="平台名称" value={result.brokerDraft.name} recognized={hasRecognizedField("name")} />
                    <FieldRow label="官网候选" value={result.brokerDraft.website} recognized={hasRecognizedField("website")} />
                    <FieldRow label="国家或地区" value={result.brokerDraft.country} recognized={hasRecognizedField("country")} />
                    <FieldRow label="监管机构" value={result.brokerDraft.regulators} recognized={hasRecognizedField("regulators")} />
                    <FieldRow label="监管等级" value={result.brokerDraft.regulationTier} recognized={hasRecognizedField("regulationTier")} />
                    <FieldRow label="客户资金隔离" value={result.brokerDraft.fundSegregation} recognized={hasRecognizedField("fundSegregation")} />
                    <FieldRow label="负余额保护" value={result.brokerDraft.negativeBalanceProtection} recognized={hasRecognizedField("negativeBalanceProtection")} />
                  </div>
                  <div>
                    <FieldRow label="EUR/USD 点差" value={result.brokerDraft.avgSpreadEurUsd} recognized={hasRecognizedField("avgSpreadEurUsd")} />
                    <FieldRow label="佣金" value={result.brokerDraft.commission} recognized={hasRecognizedField("commission")} />
                    <FieldRow label="最低入金" value={result.brokerDraft.minDeposit} recognized={hasRecognizedField("minDeposit")} />
                    <FieldRow label="最大杠杆" value={result.brokerDraft.maxLeverage} recognized={hasRecognizedField("maxLeverage")} />
                    <FieldRow label="交易平台" value={result.brokerDraft.tradingPlatforms} recognized={hasRecognizedField("tradingPlatforms")} />
                    <FieldRow label="出入金方式" value={result.brokerDraft.depositWithdrawMethods} recognized={hasRecognizedField("depositWithdrawMethods")} />
                    <FieldRow label="客服渠道" value={result.brokerDraft.customerSupport} recognized={hasRecognizedField("customerSupport")} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>证据摘录</CardTitle>
              </CardHeader>
              <CardContent>
                {result.evidence.length ? (
                  <div className="space-y-3">
                    {result.evidence.slice(0, 12).map((item, index) => (
                      <div key={`${item.field}-${index}`} className="rounded-md border border-border p-3 text-sm">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="font-medium">{item.field}: {item.value}</span>
                          <button className="text-primary hover:underline" onClick={() => void forexApi.openExternal(item.sourceUrl)}>
                            来源
                          </button>
                        </div>
                        {typeof item.confidence === "number" && (
                          <div className="mb-2 text-xs text-muted-foreground">字段置信度：{item.confidence.toFixed(0)}%</div>
                        )}
                        <p className="text-muted-foreground">{item.excerpt}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">没有生成足够明确的字段证据，请查看来源链接并手动核实。</p>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>自动评分预览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScoreMeter score={score.total} />
                <RiskBadge riskLevel={score.riskLevel} />
                <p className="text-xs text-muted-foreground">评分基于候选字段自动计算，保存后仍需用户自行核实。</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>研究质量</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>资料完整度</span>
                    <span>阈值 {settings.minResearchCompleteness}%</span>
                  </div>
                  <ScoreMeter score={result.dataCompleteness} />
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">平均证据置信度</div>
                  <ScoreMeter score={result.averageConfidence} />
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                  研究来源：{result.researchProvider}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>来源</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge tone={fetchedCount > 0 ? "success" : "warning"}>{fetchedCount} 个页面已抓取</Badge>
                  <Badge tone="neutral">{result.sources.length} 个搜索结果</Badge>
                </div>
                {result.sources.map((source) => (
                  <div key={source.url} className="rounded-md border border-border p-3 text-sm">
                    <button className="flex items-center gap-1 font-medium text-primary hover:underline" onClick={() => void forexApi.openExternal(source.url)}>
                      {source.title || source.url}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">{source.snippet || source.status}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {result.warnings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>核实提醒</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.warnings.map((warning) => (
                    <div key={warning} className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-sm">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
