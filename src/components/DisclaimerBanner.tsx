import { AlertTriangle } from "lucide-react";

export const DisclaimerBanner = () => (
  <div className="flex gap-3 rounded-md border border-warning/35 bg-warning/10 p-3 text-sm text-foreground">
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
    <p>
      本应用仅用于信息整理和研究，不构成投资建议。外汇和 CFD 交易存在高风险，平台监管状态、费用、点差和政策可能变化，所有结论都需要用户自行前往监管机构官网和平台官网核实。
    </p>
  </div>
);
