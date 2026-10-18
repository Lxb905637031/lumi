export type Metric = {
  label: string;
  value: number;
};

export function MetricCard({ label, value }: Metric) {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-lg border border-lumi-line bg-lumi-surface p-5">
      <span className="text-sm text-lumi-muted">{label}</span>
      <strong className="text-3xl font-semibold tabular-nums">{value}</strong>
    </article>
  );
}
