import TechMetricsFeaturePage from "@/features/tech/metrics/page";

export default function Page(props: {
  searchParams?: Promise<{ range?: string }>;
}) {
  return <TechMetricsFeaturePage searchParams={props.searchParams} />;
}