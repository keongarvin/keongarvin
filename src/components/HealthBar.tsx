export default function HealthBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    clamped >= 80 ? "bg-pine-600" : clamped >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
