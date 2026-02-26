// RUN THIS
// Replace the entire file:
// apps/web/src/features/roster/components/RosterTable.tsx

"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import type { RosterRow } from "@/shared/lib/api";
import { DataTable, DataTableHeader, DataTableBody, DataTableRow } from "@/components/ui/DataTable";
import { useSession } from "@/state/session";
import { useRosterManageAccess } from "@/features/roster/hooks/useRosterManageAccess";
import { useOrg } from "@/state/org";

const rosterGridStyle: CSSProperties = {
  gridTemplateColumns:
    "6rem minmax(12rem,1fr) 10rem 10rem 7rem 10rem minmax(0,1fr) minmax(0,1fr) 10rem",
};

function formatPhone(v: unknown) {
  const raw = String(v ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "—";

  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (d.length !== 10) return raw;

  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6);
  return `(${a}) ${b}-${c}`;
}

type Pattern = {
  sun: boolean | null;
  mon: boolean | null;
  tue: boolean | null;
  wed: boolean | null;
  thu: boolean | null;
  fri: boolean | null;
  sat: boolean | null;
};

type PatternRow = Pattern & {
  assignment_id: string | null;
  tech_id: string | null;
};

function on(v: any) {
  return v === true;
}

function hasAny(p: Pattern | null) {
  if (!p) return false;
  return on(p.sun) || on(p.mon) || on(p.tue) || on(p.wed) || on(p.thu) || on(p.fri) || on(p.sat);
}

const CHIP = { size: 22, gap: 7, font: 10, radius: 6 };

const STYLE_ON = { background: "rgba(34, 197, 94, 0.18)", color: "var(--to-status-success)" };
const STYLE_OFF = { background: "rgba(245, 158, 11, 0.18)", color: "var(--to-status-warning)" };
const STYLE_NONE = { background: "rgba(148, 163, 184, 0.08)", color: "var(--to-ink-muted)" };

function LegendPill({ label, kind }: { label: string; kind: "on" | "off" }) {
  const dotStyle = kind === "on" ? STYLE_ON : STYLE_OFF;

  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        height: CHIP.size,
        paddingLeft: 8,
        paddingRight: 8,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "1",
        background: "transparent",
        border: "1px solid rgba(148, 163, 184, 0.28)",
        color: "var(--to-text)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: dotStyle.background,
          outline: "1px solid rgba(0,0,0,0.04)",
        }}
      />
      {label}
    </span>
  );
}

function ScheduleWeek({ pattern }: { pattern: Pattern | null }) {
  const days = useMemo(
    () =>
      [
        ["sun", "U"],
        ["mon", "M"],
        ["tue", "T"],
        ["wed", "W"],
        ["thu", "H"],
        ["fri", "F"],
        ["sat", "S"],
      ] as const,
    []
  );

  const any = hasAny(pattern);

  return (
    <div className="flex items-center justify-end">
      <div className="grid grid-cols-7" style={{ gap: CHIP.gap, justifyItems: "center" }}>
        {days.map(([k, label]) => {
          const active = pattern ? on((pattern as any)[k]) : false;
          const style = !any ? STYLE_NONE : active ? STYLE_ON : STYLE_OFF;

          return (
            <div
              key={k}
              className="flex items-center justify-center"
              style={{
                ...style,
                width: CHIP.size,
                height: CHIP.size,
                borderRadius: CHIP.radius,
                fontSize: CHIP.font,
                fontWeight: 600,
                lineHeight: "1",
              }}
              title={!any ? `No baseline pattern` : active ? `Scheduled: ${label}` : `Off: ${label}`}
              aria-label={!any ? `No baseline pattern` : active ? `Scheduled ${label}` : `Off ${label}`}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RosterTable({
  roster,
  onRowOpen,
  onRowQuickView,
  modifyMode = "open",
  pickName,
}: {
  roster: RosterRow[];
  modifyMode?: "open" | "locked";
  onRowOpen: (row: RosterRow) => void;
  onRowQuickView?: (row: RosterRow, anchorEl: HTMLElement) => void;
  pickName: (row: RosterRow) => string;
}) {
  const { isOwner } = useSession();
  const { allowed: canManageRoster } = useRosterManageAccess();
  const { selectedPcOrgId } = useOrg() as any;

  const canEditRoster = isOwner || canManageRoster;
  const effectiveModifyMode: "open" | "locked" = canEditRoster ? modifyMode : "locked";

  const pcOrgId =
    String(selectedPcOrgId ?? "").trim() ||
    String((roster?.[0] as any)?.pc_org_id ?? (roster?.[0] as any)?.person_pc_org_id ?? "").trim();

  const [schedByAssignment, setSchedByAssignment] = useState<Map<string, Pattern>>(new Map());
  const [schedByTech, setSchedByTech] = useState<Map<string, Pattern>>(new Map());

  useEffect(() => {
    let alive = true;
    if (!pcOrgId) {
      setSchedByAssignment(new Map());
      setSchedByTech(new Map());
      return;
    }

    async function load() {
      try {
        const res = await fetch("/api/roster/schedule-pattern", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pc_org_id: pcOrgId }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Failed to load schedule pattern");

        const rows = (Array.isArray(json?.rows) ? json.rows : []) as PatternRow[];

        const byA = new Map<string, Pattern>();
        const byT = new Map<string, Pattern>();

        for (const r of rows) {
          const p: Pattern = {
            sun: r.sun ?? null,
            mon: r.mon ?? null,
            tue: r.tue ?? null,
            wed: r.wed ?? null,
            thu: r.thu ?? null,
            fri: r.fri ?? null,
            sat: r.sat ?? null,
          };

          const aid = String(r.assignment_id ?? "").trim();
          const tid = String(r.tech_id ?? "").trim();

          if (aid) byA.set(aid, p);
          if (tid) byT.set(tid, p);
        }

        if (!alive) return;
        setSchedByAssignment(byA);
        setSchedByTech(byT);
      } catch {
        if (!alive) return;
        setSchedByAssignment(new Map());
        setSchedByTech(new Map());
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [pcOrgId]);

  return (
    <div className="font-mono" style={{ fontFeatureSettings: '"zero" 1, "tnum" 1' }}>
      <DataTable zebra hover layout="fixed" gridStyle={rosterGridStyle}>
        <DataTableHeader>
          <div className="whitespace-nowrap">Tech ID</div>
          <div className="min-w-0">Name</div>
          <div className="whitespace-nowrap">Mobile</div>
          <div className="whitespace-nowrap">NT Login</div>
          <div className="whitespace-nowrap">CSG</div>
          <div className="whitespace-nowrap">Office</div>
          <div className="min-w-0">Reports To</div>
          <div className="min-w-0">Affiliation</div>

          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            <span>Schedule</span>
            <LegendPill label="On" kind="on" />
            <LegendPill label="Off" kind="off" />
          </div>
        </DataTableHeader>

        <DataTableBody zebra>
          {roster.map((r, idx) => {
            const assignmentId = String((r as any)?.assignment_id ?? "").trim();
            const techId = String((r as any)?.tech_id ?? "").trim();
            const pattern =
              (assignmentId && schedByAssignment.get(assignmentId)) || (techId && schedByTech.get(techId)) || null;

            return (
              <DataTableRow
                key={(r as any).assignment_id ?? (r as any).person_id ?? idx}
                className="cursor-pointer text-[13px] text-[var(--to-text)]"
                role="button"
                tabIndex={0}
                aria-label={`Open roster details for ${((r as any)?.full_name ?? pickName(r)) || "tech"}`}
                onClick={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  if (effectiveModifyMode === "locked") onRowQuickView?.(r, el);
                  else onRowOpen(r);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    const el = e.currentTarget as HTMLElement;
                    if (modifyMode === "locked") onRowQuickView?.(r, el);
                    else onRowOpen(r);
                  }
                }}
              >
                <div className="whitespace-nowrap">{(r as any)?.tech_id ?? "—"}</div>
                <div className="min-w-0 truncate">{(r as any)?.full_name ?? pickName(r)}</div>
                <div className="whitespace-nowrap">{formatPhone((r as any)?.mobile)}</div>
                <div className="whitespace-nowrap">{(r as any)?.person_nt_login ?? "—"}</div>
                <div className="whitespace-nowrap">{(r as any)?.person_csg_id ?? "—"}</div>
                <div className="whitespace-nowrap">{(r as any)?.office_name ?? "—"}</div>
                <div className="min-w-0 truncate">{(r as any)?.reports_to_full_name ?? "—"}</div>
                <div className="min-w-0 truncate">{(r as any)?.co_name ?? "—"}</div>
                <ScheduleWeek pattern={pattern} />
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
    </div>
  );
}