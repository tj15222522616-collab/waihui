import { Save, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { ScoreMeter } from "../components/ScoreMeter";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { forexApi } from "../services/forexApi";
import { calculateBrokerScore } from "../scoring/calculateBrokerScore";
import type { Broker, BrokerDraft } from "../types/broker";
import { regulationTiers, riskLevelLabels } from "../types/broker";
import { createEmptyBrokerDraft, normalizeBrokerDraft, parseNullableNumber, splitList } from "../utils/brokerDraft";

interface BrokerFormPageProps {
  mode: "create" | "edit";
  broker?: Broker | null;
  onSaved: () => Promise<void>;
  onDone: () => void;
}

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

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="space-y-1.5">
    <span className="text-sm font-medium">{label}</span>
    {children}
  </label>
);

export const BrokerFormPage = ({ mode, broker, onSaved, onDone }: BrokerFormPageProps) => {
  const [draft, setDraft] = useState<BrokerDraft>(() => (mode === "edit" && broker ? brokerToDraft(broker) : createEmptyBrokerDraft()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "edit" && broker) setDraft(brokerToDraft(broker));
    if (mode === "create") setDraft(createEmptyBrokerDraft());
  }, [broker, mode]);

  const scorePreview = useMemo(() => calculateBrokerScore(normalizeBrokerDraft(draft)), [draft]);

  const update = <K extends keyof BrokerDraft>(key: K, value: BrokerDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!draft.name.trim()) {
      setError("平台名称为必填字段。");
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit" && broker) await forexApi.updateBroker(broker.id, normalizeBrokerDraft(draft));
      else await forexApi.createBroker(normalizeBrokerDraft(draft));
      await onSaved();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (mode === "edit" && !broker) {
    return (
      <Card>
        <CardContent className="text-muted-foreground">未选择平台，请从列表页进入编辑。</CardContent>
      </Card>
    );
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{mode === "create" ? "保存研究结果" : "人工修正资料"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">录入信息后系统会自动计算评分和风险等级，结论需要用户自行核实。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-56 rounded-md border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">评分预览</span>
              <Badge tone="neutral">{riskLevelLabels[scorePreview.riskLevel]}</Badge>
            </div>
            <ScoreMeter score={scorePreview.total} />
          </div>
          <Button type="button" variant="secondary" onClick={onDone}>
            <X className="h-4 w-4" aria-hidden="true" />
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>基础信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <Field label="平台名称">
            <Input value={draft.name} onChange={(event) => update("name", event.target.value)} required />
          </Field>
          <Field label="官网">
            <Input value={draft.website} onChange={(event) => update("website", event.target.value)} placeholder="https://..." />
          </Field>
          <Field label="国家或地区">
            <Input value={draft.country} onChange={(event) => update("country", event.target.value)} />
          </Field>
          <Field label="监管机构">
            <Input value={draft.regulators.join("; ")} onChange={(event) => update("regulators", splitList(event.target.value))} placeholder="多个值用分号分隔" />
          </Field>
          <Field label="监管等级">
            <Select value={draft.regulationTier} onChange={(event) => update("regulationTier", event.target.value as BrokerDraft["regulationTier"])}>
              {regulationTiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="更新时间">
            <Input type="date" value={draft.lastUpdated} onChange={(event) => update("lastUpdated", event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <Checkbox checked={draft.fundSegregation} onChange={(event) => update("fundSegregation", event.target.checked)} />
            是否客户资金隔离
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <Checkbox checked={draft.negativeBalanceProtection} onChange={(event) => update("negativeBalanceProtection", event.target.checked)} />
            是否有负余额保护
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <Checkbox checked={draft.chineseSupport} onChange={(event) => update("chineseSupport", event.target.checked)} />
            是否支持中文
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>费用与交易条件</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <Field label="EUR/USD 平均点差">
            <Input
              inputMode="decimal"
              value={draft.avgSpreadEurUsd ?? ""}
              onChange={(event) => update("avgSpreadEurUsd", parseNullableNumber(event.target.value))}
            />
          </Field>
          <Field label="佣金说明">
            <Input value={draft.commission} onChange={(event) => update("commission", event.target.value)} />
          </Field>
          <Field label="最低入金">
            <Input inputMode="decimal" value={draft.minDeposit ?? ""} onChange={(event) => update("minDeposit", parseNullableNumber(event.target.value))} />
          </Field>
          <Field label="最大杠杆">
            <Input value={draft.maxLeverage} onChange={(event) => update("maxLeverage", event.target.value)} placeholder="例如 1:30" />
          </Field>
          <Field label="支持的交易软件">
            <Input
              value={draft.tradingPlatforms.join("; ")}
              onChange={(event) => update("tradingPlatforms", splitList(event.target.value))}
              placeholder="MT4; MT5; cTrader; TradingView"
            />
          </Field>
          <Field label="可交易品种">
            <Input value={draft.assets.join("; ")} onChange={(event) => update("assets", splitList(event.target.value))} />
          </Field>
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <Checkbox checked={draft.apiSupport} onChange={(event) => update("apiSupport", event.target.checked)} />
            是否支持 API
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>出入金、客服与来源</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="出入金方式">
            <Input value={draft.depositWithdrawMethods.join("; ")} onChange={(event) => update("depositWithdrawMethods", splitList(event.target.value))} />
          </Field>
          <Field label="客服渠道">
            <Input value={draft.customerSupport.join("; ")} onChange={(event) => update("customerSupport", splitList(event.target.value))} />
          </Field>
          <Field label="教育资源说明">
            <Textarea value={draft.educationResources} onChange={(event) => update("educationResources", event.target.value)} />
          </Field>
          <Field label="信息来源链接">
            <Textarea value={draft.sourceUrls.join("\n")} onChange={(event) => update("sourceUrls", splitList(event.target.value))} placeholder="每行或分号分隔一个链接" />
          </Field>
          <div className="col-span-2">
            <Field label="备注">
              <Textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};
