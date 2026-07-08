import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MetricBucket = {
  files: number;
  loc: number;
};

type FileMetric = {
  path: string;
  loc: number;
  extension: string;
};

type RepoHealthSnapshot = {
  generated_at: string;
  total: MetricBucket;
  by_group: Record<string, MetricBucket>;
  apps_web_src: Record<string, MetricBucket>;
  by_extension: Record<string, MetricBucket>;
  large_files: FileMetric[];
  largest_files: FileMetric[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function findRepoRoot(startDir: string) {
  let current = startDir;

  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(current, "tooling/reports/repo-health-latest.json");

    try {
      await fs.access(candidate);
      return current;
    } catch {
      current = path.dirname(current);
    }
  }

  return startDir;
}

async function readSnapshot(): Promise<RepoHealthSnapshot | null> {
  try {
    const repoRoot = await findRepoRoot(process.cwd());
    const filePath = path.join(repoRoot, "tooling/reports/repo-health-latest.json");
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as RepoHealthSnapshot;
  } catch {
    return null;
  }
}

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

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0" style={{ borderColor: "var(--to-border)" }}>
      <div className="min-w-0">
        <div className="truncate text-sm text-[var(--to-ink-muted)]">{label}</div>
        {note ? <div className="truncate text-xs text-[var(--to-ink-muted)]">{note}</div> : null}
      </div>
      <span className="shrink-0 text-sm font-medium">{value}</span>
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

  const snapshot = await readSnapshot();

  if (!snapshot) {
    return (
      <div className="grid gap-6">
        <header className="grid gap-1">
          <h1 className="text-xl font-semibold">Owner Console</h1>
          <p className="text-sm text-[var(--to-ink-muted)]">
            Internal Team Optix command center for engineering, product, and operating health.
          </p>
        </header>

        <section className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
          <h2 className="text-sm font-semibold">Repo Health Snapshot Missing</h2>
          <p className="mt-2 text-sm text-[var(--to-ink-muted)]">
            Run <code>node tooling/scripts/repo-health.mjs</code> to generate the latest snapshot.
          </p>
        </section>
      </div>
    );
  }

  const appsLoc = snapshot.by_group.apps?.loc ?? 0;
  const featuresLoc = snapshot.apps_web_src["src/features"]?.loc ?? 0;
  const sharedLoc = snapshot.apps_web_src["src/shared"]?.loc ?? 0;

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-xl font-semibold">Owner Console</h1>
        <p className="text-sm text-[var(--to-ink-muted)]">
          Internal Team Optix command center for engineering, product, and operating health.
        </p>
        <p className="text-xs text-[var(--to-ink-muted)]">
          Repo snapshot generated {formatDate(snapshot.generated_at)}.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Repository LOC" value={formatNumber(snapshot.total.loc)} note={`${formatNumber(snapshot.total.files)} tracked files`} />
        <MetricCard label="Application LOC" value={formatNumber(appsLoc)} note="apps" />
        <MetricCard label="Feature LOC" value={formatNumber(featuresLoc)} note="apps/web/src/features" />
        <MetricCard label="Shared LOC" value={formatNumber(sharedLoc)} note="apps/web/src/shared" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
          <h2 className="text-sm font-semibold">Repository Health</h2>
          <div className="mt-3">
            {Object.entries(snapshot.by_group).map(([label, metric]) => (
              <Row key={label} label={label} value={`${formatNumber(metric.loc)} LOC`} note={`${formatNumber(metric.files)} files`} />
            ))}
          </div>
        </div>

        <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
          <h2 className="text-sm font-semibold">apps/web Breakdown</h2>
          <div className="mt-3">
            {Object.entries(snapshot.apps_web_src).map(([label, metric]) => (
              <Row key={label} label={label} value={`${formatNumber(metric.loc)} LOC`} note={`${formatNumber(metric.files)} files`} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
          <h2 className="text-sm font-semibold">Largest Files</h2>
          <div className="mt-3">
            {snapshot.largest_files.slice(0, 10).map((file) => (
              <Row key={file.path} label={file.path} value={`${formatNumber(file.loc)} LOC`} />
            ))}
          </div>
        </div>

        <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
          <h2 className="text-sm font-semibold">Technical Debt Signals</h2>
          <div className="mt-3">
            <Row label="Files over 500 LOC" value={formatNumber(snapshot.large_files.length)} />
            <Row label="Largest tracked file" value={`${formatNumber(snapshot.largest_files[0]?.loc ?? 0)} LOC`} note={snapshot.largest_files[0]?.path ?? "None"} />
            <Row label="Next target" value="Persist snapshots" note="Future table: owner_repo_health_snapshot" />
          </div>
        </div>
      </section>
    </div>
  );
}
