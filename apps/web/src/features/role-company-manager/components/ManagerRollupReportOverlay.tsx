// path: apps/web/src/features/role-company-manager/components/ManagerRollupReportOverlay.tsx

"use client";

type ReportRange = "FM" | "PREVIOUS" | "3FM" | "12FM";
type ReportClass = "NSR" | "SMART";
type TeamClass = "ITG" | "BP";

type RollupKpi = {
  kpi_key: string;
  label: string;
  value: number | null;
  value_display: string;
  band_key: string | null;
};

type SupervisorRollupRow = {
  supervisor_person_id: string;
  supervisor_name: string;
  team_class: TeamClass;
  rollup_hc: number;
  composite_score: number | null;
  rank: number;
  kpis: RollupKpi[];
};

export type ManagerRollupReportPayload = {
  header: {
    generated_at: string;
    class_type: ReportClass;
    range: ReportRange;
    org_display: string | null;
  };
  segments: {
    itg_supervisors: SupervisorRollupRow[];
    bp_supervisors: SupervisorRollupRow[];
    all_supervisors: SupervisorRollupRow[];
  };
};

type Props = {
  open: boolean;
  loading?: boolean;
  payload: ManagerRollupReportPayload | null;
  error?: string | null;
  onClose: () => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatScore(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function shortKpiLabel(kpi: RollupKpi) {
  const map: Record<string, string> = {
    tnps_score: "tNPS",
    ftr_rate: "FTR",
    tool_usage_rate: "Tool",
    contact_48hr_rate: "48Hr",
    pht_pure_pass_rate: "PHT",
    soi_rate: "SOI",
    repeat_rate: "Repeat",
    rework_rate: "Rework",
    met_rate: "MET",
  };

  return map[kpi.kpi_key] ?? kpi.label ?? kpi.kpi_key;
}

function bandTone(band: string | null) {
  if (band === "EXCEEDS") return "pill-exceeds";
  if (band === "MEETS") return "pill-meets";
  if (band === "NEEDS_IMPROVEMENT") return "pill-needs";
  if (band === "MISSES") return "pill-misses";
  return "pill-empty";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPrintRows(rows: SupervisorRollupRow[]) {
  const sampleKpis = rows[0]?.kpis ?? [];

  return rows
    .map((row) => {
      const kpis = sampleKpis
        .map((sample) => {
          const kpi = row.kpis.find((item) => item.kpi_key === sample.kpi_key);
          return `<td class="center"><span class="pill ${
            kpi ? bandTone(kpi.band_key) : "pill-empty"
          }">${escapeHtml(kpi?.value_display ?? "—")}</span></td>`;
        })
        .join("");

      return `
        <tr>
          <td class="strong">#${row.rank}</td>
          <td class="name">${escapeHtml(row.supervisor_name)}</td>
          <td>${row.team_class}</td>
          <td class="right strong">${row.rollup_hc}</td>
          <td class="right strong">${formatScore(row.composite_score)}</td>
          ${kpis}
        </tr>
      `;
    })
    .join("");
}

function buildPrintTable(args: {
  title: string;
  subtitle: string;
  rows: SupervisorRollupRow[];
}) {
  const sampleKpis = args.rows[0]?.kpis ?? [];
  const kpiHeaders = sampleKpis
    .map((kpi) => `<th class="center">${escapeHtml(shortKpiLabel(kpi))}</th>`)
    .join("");

  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h2>${escapeHtml(args.title)}</h2>
          <p>${escapeHtml(args.subtitle)}</p>
        </div>
        <span class="count">${args.rows.length} supervisors</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Supervisor</th>
            <th>Type</th>
            <th class="right">HC</th>
            <th class="right">Comp.</th>
            ${kpiHeaders}
          </tr>
        </thead>
        <tbody>
          ${buildPrintRows(args.rows)}
        </tbody>
      </table>
    </section>
  `;
}

function buildPrintHtml(payload: ManagerRollupReportPayload) {
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Manager Rollup Report</title>
  <style>
    @page { size: landscape; margin: 0.32in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      font-size: 10px;
      background: white;
    }
    header {
      border-bottom: 1px solid #d7dde5;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .eyebrow {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #64748b;
    }
    h1 {
      margin: 2px 0;
      font-size: 16px;
      line-height: 1.1;
    }
    .meta {
      color: #64748b;
      font-size: 9px;
    }
    .section {
      border: 1px solid #d7dde5;
      border-radius: 10px;
      padding: 8px;
      margin-bottom: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 5px;
    }
    h2 {
      margin: 0;
      font-size: 12px;
      line-height: 1.15;
    }
    p {
      margin: 2px 0 0;
      color: #64748b;
      font-size: 8px;
    }
    .count {
      border: 1px solid #d7dde5;
      border-radius: 999px;
      padding: 2px 7px;
      color: #64748b;
      white-space: nowrap;
      font-size: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th {
      color: #64748b;
      font-size: 7.5px;
      text-transform: uppercase;
      letter-spacing: .05em;
      text-align: left;
      border-bottom: 1px solid #d7dde5;
      padding: 4px 5px;
    }
    td {
      border-bottom: 1px solid #e5e7eb;
      padding: 5px;
      vertical-align: middle;
      font-size: 9px;
    }
    tr:last-child td { border-bottom: 0; }
    .strong { font-weight: 700; }
    .name { font-weight: 650; }
    .right { text-align: right; }
    .center { text-align: center; }
    .pill {
      display: inline-flex;
      min-width: 34px;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid;
      padding: 2px 6px;
      font-size: 8px;
      font-weight: 700;
      line-height: 1.1;
    }
    .pill-exceeds { border-color: #6ee7b7; background: #ecfdf5; color: #047857; }
    .pill-meets { border-color: #7dd3fc; background: #f0f9ff; color: #0369a1; }
    .pill-needs { border-color: #fbbf24; background: #fffbeb; color: #b45309; }
    .pill-misses { border-color: #fda4af; background: #fff1f2; color: #be123c; }
    .pill-empty { border-color: #cbd5e1; background: #f8fafc; color: #64748b; }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Manager Rollup Report</div>
    <h1>${escapeHtml(payload.header.org_display ?? "Supervisor Rankings")}</h1>
    <div class="meta">
      ${payload.header.class_type} • ${payload.header.range} •
      ITG ${payload.segments.itg_supervisors.length} •
      BP ${payload.segments.bp_supervisors.length} •
      All ${payload.segments.all_supervisors.length} •
      Generated ${escapeHtml(formatDate(payload.header.generated_at))}
    </div>
  </header>

  ${buildPrintTable({
    title: "ITG Supervisor Rollup Rankings",
    subtitle: "ITG supervisors ranked by full rollup performance.",
    rows: payload.segments.itg_supervisors,
  })}

  ${buildPrintTable({
    title: "BP Supervisor Rankings",
    subtitle: "BP supervisors ranked by BP team performance.",
    rows: payload.segments.bp_supervisors,
  })}

  ${buildPrintTable({
    title: "All Field Supervisor Rankings",
    subtitle: "Combined independent ranking across ITG and BP leadership.",
    rows: payload.segments.all_supervisors,
  })}
  
</body>
</html>`;
}

function openPrintDocument(payload: ManagerRollupReportPayload) {
  const iframe = document.createElement("iframe");

  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(buildPrintHtml(payload));
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
}

function RollupTable(props: {
  title: string;
  subtitle: string;
  rows: SupervisorRollupRow[];
}) {
  const { title, subtitle, rows } = props;
  const sampleKpis = rows[0]?.kpis ?? [];

  return (
    <section className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          {rows.length} supervisors
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2">Rank</th>
              <th className="px-2 py-2">Supervisor</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2 text-right">HC</th>
              <th className="px-2 py-2 text-right">Comp.</th>
              {sampleKpis.map((kpi) => (
                <th key={kpi.kpi_key} className="px-2 py-2 text-center">
                  {shortKpiLabel(kpi)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={`${title}-${row.supervisor_person_id}`}
                className="border-b last:border-0"
              >
                <td className="px-2 py-2 font-semibold">#{row.rank}</td>
                <td className="px-2 py-2 font-medium">{row.supervisor_name}</td>
                <td className="px-2 py-2">{row.team_class}</td>
                <td className="px-2 py-2 text-right font-semibold">
                  {row.rollup_hc}
                </td>
                <td className="px-2 py-2 text-right font-semibold">
                  {formatScore(row.composite_score)}
                </td>

                {row.kpis.map((kpi) => (
                  <td key={kpi.kpi_key} className="px-2 py-2 text-center">
                    <span
                      title={kpi.band_key ?? "NO DATA"}
                      className={[
                        "inline-flex min-w-[58px] justify-center rounded-full border px-2 py-1 text-[11px] font-semibold",
                        bandTone(kpi.band_key)
                          .replace("pill-exceeds", "border-emerald-300 bg-emerald-50 text-emerald-800")
                          .replace("pill-meets", "border-sky-300 bg-sky-50 text-sky-800")
                          .replace("pill-needs", "border-amber-300 bg-amber-50 text-amber-800")
                          .replace("pill-misses", "border-rose-300 bg-rose-50 text-rose-800")
                          .replace("pill-empty", "border-slate-200 bg-slate-50 text-slate-500"),
                      ].join(" ")}
                    >
                      {kpi.value_display}
                    </span>
                  </td>
                ))}
              </tr>
            ))}

            {!rows.length ? (
              <tr>
                <td
                  className="px-2 py-6 text-center text-muted-foreground"
                  colSpan={5 + sampleKpis.length}
                >
                  No supervisor rollup rows available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ManagerRollupReportOverlay(props: Props) {
  const { open, loading, payload, error, onClose } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Manager Rollup Report
            </p>
            <h2 className="text-xl font-semibold">
              {payload?.header.org_display ?? "Supervisor Rankings"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {payload
                ? `${payload.header.class_type} • ${payload.header.range} • ITG ${
                    payload.segments.itg_supervisors.length
                  } • BP ${payload.segments.bp_supervisors.length} • All ${
                    payload.segments.all_supervisors.length
                  } • Generated ${formatDate(payload.header.generated_at)}`
                : "Preparing report preview..."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
              onClick={() => payload && openPrintDocument(payload)}
              disabled={!payload || loading}
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-muted/20 p-5">
          {loading ? (
            <div className="rounded-2xl border bg-background p-6 text-sm text-muted-foreground">
              Building supervisor rollup report...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {payload && !loading ? (
            <div className="space-y-5">
              <RollupTable
                title="ITG Supervisor Rollup Rankings"
                subtitle="ITG supervisors ranked by full rollup performance."
                rows={payload.segments.itg_supervisors}
              />

              <RollupTable
                title="BP Supervisor Rankings"
                subtitle="BP supervisors ranked by BP team performance."
                rows={payload.segments.bp_supervisors}
              />

              <RollupTable
                title="All Field Supervisor Rankings"
                subtitle="Combined independent ranking across ITG and BP leadership."
                rows={payload.segments.all_supervisors}
              />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}