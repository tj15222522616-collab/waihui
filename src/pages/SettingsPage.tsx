import { RotateCcw, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { defaultSettings } from "../data/defaultSettings";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import type { AppSettings, ScoringWeights } from "../types/broker";

interface SettingsPageProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
}

const weightLabels: Record<keyof ScoringWeights, string> = {
  regulationSafety: "监管安全",
  tradingCosts: "交易成本",
  fundingConvenience: "出入金便利性",
  platformFeatures: "平台功能",
  customerService: "客户服务",
  transparency: "信息透明度"
};

export const SettingsPage = ({ settings, onSave }: SettingsPageProps) => {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [mappingText, setMappingText] = useState(JSON.stringify(settings.csvFieldMapping, null, 2));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const weightSum = useMemo(() => Object.values(draft.scoringWeights).reduce((sum, value) => sum + Number(value), 0), [draft.scoringWeights]);

  useEffect(() => {
    setDraft(settings);
    setMappingText(JSON.stringify(settings.csvFieldMapping, null, 2));
  }, [settings]);

  const updateWeight = (key: keyof ScoringWeights, value: number) => {
    setDraft((current) => ({
      ...current,
      scoringWeights: {
        ...current.scoringWeights,
        [key]: value
      }
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const csvFieldMapping = JSON.parse(mappingText) as AppSettings["csvFieldMapping"];
      await onSave({ ...draft, csvFieldMapping });
      setMessage("设置已保存，现有平台评分已重新计算。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">调整评分权重、联网研究、列表默认行为、深色模式和 CSV 字段映射。</p>
      </div>

      {message && <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{message}</div>}
      {error && <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>}

      <div className="grid grid-cols-[1fr_420px] gap-5">
        <Card>
          <CardHeader>
            <CardTitle>评分权重</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(weightLabels).map(([key, label]) => (
              <label key={key} className="grid grid-cols-[160px_1fr_80px] items-center gap-3">
                <span className="text-sm font-medium">{label}</span>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={draft.scoringWeights[key as keyof ScoringWeights]}
                  onChange={(event) => updateWeight(key as keyof ScoringWeights, Number(event.target.value))}
                  className="accent-[hsl(var(--primary))]"
                />
                <Input
                  inputMode="numeric"
                  value={draft.scoringWeights[key as keyof ScoringWeights]}
                  onChange={(event) => updateWeight(key as keyof ScoringWeights, Number(event.target.value) || 0)}
                />
              </label>
            ))}
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              当前权重总和：<span className="font-semibold">{weightSum}</span>
              {weightSum !== 100 && <span className="ml-2 text-warning">建议保持 100，便于满分仍为 100。</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>偏好设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">高分平台阈值</span>
              <Input
                inputMode="numeric"
                value={draft.highScoreThreshold}
                onChange={(event) => setDraft((current) => ({ ...current, highScoreThreshold: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">默认排序字段</span>
              <Select
                value={draft.defaultSortField}
                onChange={(event) => setDraft((current) => ({ ...current, defaultSortField: event.target.value as AppSettings["defaultSortField"] }))}
              >
                <option value="score">综合评分</option>
                <option value="avgSpreadEurUsd">点差</option>
                <option value="minDeposit">最低入金</option>
                <option value="name">名称</option>
                <option value="lastUpdated">更新时间</option>
              </Select>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
              <Checkbox checked={draft.darkMode} onChange={(event) => setDraft((current) => ({ ...current, darkMode: event.target.checked }))} />
              启用深色模式
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
              <Checkbox
                checked={draft.showHighRiskPlatforms}
                onChange={(event) => setDraft((current) => ({ ...current, showHighRiskPlatforms: event.target.checked }))}
              />
              显示高风险平台
            </label>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>联网研究服务</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-[280px_1fr] gap-4">
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <Checkbox
              checked={draft.useCloudResearchApi}
              onChange={(event) => setDraft((current) => ({ ...current, useCloudResearchApi: event.target.checked }))}
            />
            优先使用云端 Research API
          </label>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            客户版建议把搜索、抓取和字段抽取放在你的后端，桌面端只保存候选资料和证据，避免把搜索服务密钥写进安装包。
          </div>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">API Endpoint</span>
            <Input
              value={draft.researchApiEndpoint}
              onChange={(event) => setDraft((current) => ({ ...current, researchApiEndpoint: event.target.value }))}
              placeholder="https://api.yourdomain.com/research/broker"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Client Token</span>
            <Input
              type="password"
              value={draft.researchApiToken}
              onChange={(event) => setDraft((current) => ({ ...current, researchApiToken: event.target.value }))}
              placeholder="客户授权 token，不要填写搜索引擎 API key"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">最低资料完整度</span>
            <Input
              inputMode="numeric"
              value={draft.minResearchCompleteness}
              onChange={(event) => setDraft((current) => ({ ...current, minResearchCompleteness: Number(event.target.value) || 0 }))}
            />
          </label>
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            低于该阈值的结果会被标记为“需要复核”，不应作为筛选结论。
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV 导入字段映射</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea className="min-h-64 font-mono text-xs" value={mappingText} onChange={(event) => setMappingText(event.target.value)} />
          <p className="mt-2 text-xs text-muted-foreground">JSON 的 key 是 CSV 表头，value 是应用字段名；不导入的字段可设为 ignore。</p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDraft(defaultSettings);
            setMappingText(JSON.stringify(defaultSettings.csvFieldMapping, null, 2));
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          恢复默认
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4" aria-hidden="true" />
          保存设置
        </Button>
      </div>
    </form>
  );
};
