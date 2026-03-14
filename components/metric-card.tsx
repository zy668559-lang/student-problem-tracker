export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-panel border border-white/70 bg-white/90 p-5 shadow-panel">
      <p className="text-sm text-slate">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate">{detail}</p>
    </div>
  );
}
