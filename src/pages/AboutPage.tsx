import { ShieldAlert } from "lucide-react";
import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export const AboutPage = () => (
  <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-semibold">About / Disclaimer</h1>
      <p className="mt-1 text-sm text-muted-foreground">Forex Platform Finder 是外汇平台资料整理和研究工具。</p>
    </div>

    <DisclaimerBanner />

    <Card>
      <CardHeader>
        <CardTitle>应用边界</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6">
        <p>本应用不是交易软件，不接入真实交易，不提供下单、行情订阅、资金管理或投资建议功能。</p>
        <p>评分系统只是把用户录入的信息转换为便于筛选的研究分数，不代表任何平台一定安全、可靠、低风险或适合用户。</p>
        <p>内置 mock 数据均为示例数据，非实时排名，非投资建议，需要用户自行核实。</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>必须自行核实的信息</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {["监管机构官网牌照状态", "平台官网客户协议", "资金隔离政策", "负余额保护政策", "点差和佣金", "出入金费用和到账时间", "杠杆限制", "所在司法辖区风险"].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-md border border-border p-3">
              <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>后续可扩展方向</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-muted-foreground">
        未来可以添加网页抓取队列、监管编号字段、来源可信度、评分历史图表、多数据库备份、Windows 自动更新和更多导入模板。所有自动更新结果仍应保留人工核实流程。
      </CardContent>
    </Card>
  </div>
);
