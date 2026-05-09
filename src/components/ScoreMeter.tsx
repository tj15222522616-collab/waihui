import { Progress } from "./ui/progress";

export const ScoreMeter = ({ score }: { score: number }) => (
  <div className="flex min-w-28 items-center gap-2">
    <Progress value={score} />
    <span className="w-10 text-right text-sm font-semibold">{score.toFixed(1)}</span>
  </div>
);
