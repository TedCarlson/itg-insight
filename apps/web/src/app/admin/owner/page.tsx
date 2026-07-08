import { redirect } from "next/navigation";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MetricCardProps = {
  label: string;
  value: string;
  note?: string;
};

function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
      <div className="text-xs uppercase tracking-wide text-[var(--to-ink-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {note ? <div className="mt-1 text-sm text-[var(--to-ink-muted)]">{note}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-b-0" style={{ borderColor: "var(--to-border)" }}>
      <span className="text-sm text-[var(--to-ink-muted)]">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

async function requireOwner() {
  const sb = await supabaseServer();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  try {
    const { data, error } = await sb.rpc("is_owner");
    if (error || !data) redirect("/admin");
  } catch {
    redirect("/admin");
  }
}

export default async function OwnerConsolePage() {
  await requireOwner();

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-xl font-semibold">Owner Console</h1>
        <p className="text-sm text-[var(--to-ink-muted)]">
          Internal Team Optix command center for engineering, product, and operating health.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Repository LOC" value="128,232" note="2026-07-08 audit snapshot" />
        <MetricCard label="Application LOC" value="122,289" note="apps/web" />
        <MetricCard label="Feature LOC" value="54,709" note="src/features" />
        <MetricCard label="Shared LOC" value="37,918" note="src/shared" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
          <h2 className="text-sm font-semibold">Repository Health</h2>
          <div className="mt-3">
            <Row label="apps" value="122,289 LOC" />
            <Row label="supabase" value="642 LOC" />
            <Row label="scripts" value="219 LOC" />
            <Row label="docs" value="239 LOC" />
            <Row label="root project files" value="4,770 LOC" />
          </div>
        </div>

        <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
          <h2 className="text-sm font-semibold">apps/web Breakdown</h2>
          <div className="mt-3">
            <Row label="src/features" value="54,709 LOC" />
            <Row label="src/shared" value="37,918 LOC" />
            <Row label="src/app" value="23,826 LOC" />
            <Row label="src/components" value="3,218 LOC" />
            <Row label="src/styles" value="556 LOC" />
            <Row label="src/state" value="403 LOC" />
            <Row label="src/lib" value="220 LOC" />
            <Row label="src/hooks" value="84 LOC" />
          </div>
        </div>
      </section>

      <section className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
        <h2 className="text-sm font-semibold">Technical Debt Signals</h2>
        <div className="mt-3 grid gap-2 text-sm text-[var(--to-ink-muted)]">
          <div>Known issue: large file debt still needs cleanup.</div>
          <div>Next target: automate repo audit snapshots instead of hardcoding metrics.</div>
          <div>Future table: owner_repo_health_snapshot.</div>
        </div>
      </section>
    </div>
  );
}
