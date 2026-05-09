import { Download, FileInput, Upload } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { forexApi } from "../services/forexApi";
import { applyBrokerFilters, defaultBrokerFilters } from "../services/filterBrokers";
import type { AppSettings, Broker, BrokerDraft, BrokerFilters, DuplicateImportMode, ImportResult, ImportValidationIssue } from "../types/broker";
import { riskLevelLabels, riskLevels } from "../types/broker";
import { brokersToCsv, downloadCsv, parseCsvText, validateCsvRecords } from "../utils/csv";

interface ImportExportPageProps {
  brokers: Broker[];
  settings: AppSettings;
  onImported: () => Promise<void>;
}

export const ImportExportPage = ({ brokers, settings, onImported }: ImportExportPageProps) => {
  const [drafts, setDrafts] = useState<BrokerDraft[]>([]);
  const [issues, setIssues] = useState<ImportValidationIssue[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateImportMode>("skip");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [exportFilters, setExportFilters] = useState<BrokerFilters>(defaultBrokerFilters(settings));

  const filteredBrokers = useMemo(() => applyBrokerFilters(brokers, exportFilters, settings), [brokers, exportFilters, settings]);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);
    const text = await file.text();
    const records = await parseCsvText(text);
    const validation = validateCsvRecords(
      records,
      brokers.map((broker) => broker.name),
      settings.csvFieldMapping
    );
    setDrafts(validation.validRows);
    setIssues(validation.issues);
    setDuplicates(validation.duplicateNames);
  };

  const importRows = async () => {
    const result = await forexApi.importCsvRows(drafts, duplicateMode);
    setImportResult(result);
    await onImported();
  };

  const exportRows = async () => {
    const rows = await forexApi.exportCsvRows(filteredBrokers.map((broker) => broker.id));
    downloadCsv(`forex-platform-finder-${new Date().toISOString().slice(0, 10)}.csv`, brokersToCsv(rows));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Import / Export</h1>
        <p className="mt-1 text-sm text-muted-foreground">CSV 导入会做基础校验，导出会使用当前筛选结果。</p>
      </div>

      <div className="grid grid-cols-[1fr_420px] gap-5">
        <Card>
          <CardHeader>
            <CardTitle>CSV 导入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-6 text-center hover:bg-muted/50">
              <FileInput className="mb-2 h-6 w-6 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium">选择 CSV 文件</span>
              <span className="mt-1 text-xs text-muted-foreground">支持表头字段映射，数组字段可用分号分隔。</span>
              <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void onFileChange(event)} />
            </label>

            {fileName && (
              <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <span>{fileName}</span>
                <Badge tone="neutral">{drafts.length} 行可导入</Badge>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as DuplicateImportMode)} className="max-w-56">
                <option value="skip">重复名称：跳过</option>
                <option value="merge">重复名称：合并</option>
              </Select>
              <Button onClick={() => void importRows()} disabled={drafts.length === 0 || issues.some((issue) => issue.severity === "error")}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                导入有效数据
              </Button>
            </div>

            {duplicates.length > 0 && <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">检测到重复平台：{duplicates.join(", ")}</div>}

            {issues.length > 0 && (
              <div className="max-h-52 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">行</th>
                      <th className="px-3 py-2">字段</th>
                      <th className="px-3 py-2">级别</th>
                      <th className="px-3 py-2">提示</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((issue, index) => (
                      <tr key={`${issue.row}-${issue.field}-${index}`} className="border-t border-border">
                        <td className="px-3 py-2">{issue.row}</td>
                        <td className="px-3 py-2">{issue.field}</td>
                        <td className="px-3 py-2">
                          <Badge tone={issue.severity === "error" ? "danger" : "warning"}>{issue.severity}</Badge>
                        </td>
                        <td className="px-3 py-2">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {importResult && (
              <div className="rounded-md border border-border p-3 text-sm">
                已创建 {importResult.created}，已更新 {importResult.updated}，已跳过 {importResult.skipped}
                {importResult.errors.length > 0 && <p className="mt-2 text-danger">{importResult.errors.join("；")}</p>}
                {importResult.warnings.length > 0 && <p className="mt-2 text-warning">{importResult.warnings.join("；")}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSV 导出</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="筛选导出内容"
              value={exportFilters.search}
              onChange={(event) => setExportFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <Select
              value={exportFilters.riskLevel}
              onChange={(event) => setExportFilters((current) => ({ ...current, riskLevel: event.target.value as BrokerFilters["riskLevel"] }))}
            >
              <option value="All">全部风险等级</option>
              {riskLevels.map((risk) => (
                <option key={risk} value={risk}>
                  {riskLevelLabels[risk]}
                </option>
              ))}
            </Select>
            <Select
              value={exportFilters.sortBy}
              onChange={(event) => setExportFilters((current) => ({ ...current, sortBy: event.target.value as BrokerFilters["sortBy"] }))}
            >
              <option value="score">按评分排序</option>
              <option value="avgSpreadEurUsd">按点差排序</option>
              <option value="minDeposit">按最低入金排序</option>
              <option value="lastUpdated">按更新时间排序</option>
            </Select>
            <Button className="w-full" onClick={() => void exportRows()}>
              <Download className="h-4 w-4" aria-hidden="true" />
              导出当前筛选结果（{filteredBrokers.length}）
            </Button>
            <p className="text-xs text-muted-foreground">导出的 CSV 包含评分和风险等级，但不构成投资建议。</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>导入预览</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">平台名称</th>
                  <th className="px-3 py-2">国家或地区</th>
                  <th className="px-3 py-2">监管等级</th>
                  <th className="px-3 py-2">点差</th>
                  <th className="px-3 py-2">交易平台</th>
                  <th className="px-3 py-2">来源</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft, index) => (
                  <tr key={`${draft.name}-${index}`} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{draft.name}</td>
                    <td className="px-3 py-2">{draft.country || "-"}</td>
                    <td className="px-3 py-2">{draft.regulationTier}</td>
                    <td className="px-3 py-2">{draft.avgSpreadEurUsd ?? "未知"}</td>
                    <td className="px-3 py-2">{draft.tradingPlatforms.join(", ") || "-"}</td>
                    <td className="px-3 py-2">{draft.sourceUrls.length}</td>
                  </tr>
                ))}
                {drafts.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>
                      选择 CSV 后会显示预览。
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
