export const runtime = "nodejs";

export default async function TechFieldLogDetailPage(props: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await props.params;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tech Field Log Detail
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Detail shell placeholder for report {reportId}.
        </div>
      </section>
    </div>
  );
}
