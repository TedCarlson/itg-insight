import Sparkline from "@/shared/components/Sparkline";

type SparkPoint = {
  kpi_value: number | null;
  is_month_final?: boolean;
  band_color?: string | null;
};

type Props = {
  title?: string;
  subtitle?: string | null;
  badgeValue?: string | null;
  points: SparkPoint[];
  currentValue?: string | null;
  updatesCount?: number | null;
  monthsCount?: number | null;
  rangeLabel?: string | null;
};

export default function MetricTrendSection({ points, monthsCount }: Props) {
  const sparkValues = points.map((point) => ({
    kpi_value: point.kpi_value,
    is_month_final: point.is_month_final ?? false,
    band_color: point.band_color ?? null,
  }));

  return (
    <div className="rounded-2xl border bg-background px-4 py-4">
      <Sparkline values={sparkValues} monthsCount={monthsCount ?? null} />
    </div>
  );
}