import { Badge } from "./ui/badge";
import { riskLevelLabels, riskLevelTone, type RiskLevel } from "../types/broker";

export const RiskBadge = ({ riskLevel }: { riskLevel: RiskLevel }) => (
  <Badge tone={riskLevelTone[riskLevel]}>{riskLevelLabels[riskLevel]}</Badge>
);
