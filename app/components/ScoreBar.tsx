export function ScoreBar({
  score,
  max = 5,
  className = "h-2 w-32",
}: {
  score: number;
  max?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className={`rounded-full bg-slate-200 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-status-managed transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
