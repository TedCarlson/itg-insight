"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";

export type RangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";
export type ClassType = "P4P" | "SMART" | "TECH";

export type CompanySupervisorHeaderModel = {
  role_label: string | null;

  // ✅ NEW — main title (user)
  rep_full_name: string | null;

  // ✅ resolved context (must come from payload, same as KPI strip)
  division_label: string | null;
  org_display: string | null;
  pc_label: string | null;

  headcount: number;
  as_of_date: string;
};

type Props = {
  header: CompanySupervisorHeaderModel;
};

function normalizeRange(value: string | null | undefined): RangeKey {
  const upper = String(value ?? "FM").toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

function normalizeClass(value: string | null | undefined): ClassType {
  const upper = String(value ?? "P4P").toUpperCase();
  if (upper === "SMART") return "SMART";
  if (upper === "TECH") return "TECH";
  return "P4P";
}

function formatAsOfDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function InlineSpinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function Chip(props: {
  label: string;
  active?: boolean;
  pending?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.pending}
      className={[
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition active:scale-[0.98]",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)]"
          : "bg-background text-muted-foreground hover:bg-muted/30",
        props.pending ? "opacity-90" : "",
      ].join(" ")}
    >
      {props.pending ? <InlineSpinner /> : null}
      {props.label}
    </button>
  );
}

function StatTile(props: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-1 text-xl font-semibold leading-none">
        {props.value}
      </div>
    </div>
  );
}

function buildContextLine(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" • ");
}

export default function CompanySupervisorHeader({ header }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const [showFilters, setShowFilters] = useState(false);
  const [pendingRange, setPendingRange] = useState<RangeKey | null>(null);
  const [pendingClass, setPendingClass] = useState<ClassType | null>(null);

  const activeRange = normalizeRange(searchParams.get("range"));
  const activeClass = normalizeClass(searchParams.get("class"));

  const optimisticRange =
    isPending && pendingRange ? pendingRange : activeRange;

  const optimisticClass =
    isPending && pendingClass ? pendingClass : activeClass;

  function updateParams(next: {
    range?: RangeKey;
    class_type?: ClassType;
  }) {
    startTransition(() => {
      const qs = new URLSearchParams(searchParams.toString());

      if (next.range) {
        if (next.range === "FM") qs.delete("range");
        else qs.set("range", next.range);
      }

      if (next.class_type) {
        if (next.class_type === "P4P") qs.delete("class");
        else qs.set("class", next.class_type);
      }

      const href = qs.toString()
        ? `?${qs.toString()}`
        : window.location.pathname;

      router.push(href);
      router.refresh();
    });
  }

  function setRange(next: RangeKey) {
    if (next === activeRange) return;
    setPendingRange(next);
    updateParams({ range: next });
  }

  function setClass(next: ClassType) {
    if (next === activeClass) return;
    setPendingClass(next);
    updateParams({ class_type: next });
  }

  const contextLine = buildContextLine([
    header.division_label,
    header.org_display,
    header.pc_label,
  ]);

  return (
    <Card className={`p-4 ${isPending ? "opacity-90" : ""}`}>
      {/* TOP */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {/* eyebrow */}
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {header.role_label ?? "Company Supervisor"}
          </div>

          {/* ✅ MAIN TITLE = USER */}
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {header.rep_full_name ?? "—"}
          </div>

          {/* ✅ CLEAN CONTEXT LINE */}
          {contextLine && (
            <div className="mt-2 text-sm text-muted-foreground">
              {contextLine}
            </div>
          )}
        </div>

        <div className="flex items-start gap-3">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Headcount" value={header.headcount} />
            <StatTile
              label="As Of"
              value={formatAsOfDate(header.as_of_date)}
            />
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className="h-[42px] rounded-xl border px-3 text-sm font-medium hover:bg-muted/30"
          >
            Filters
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      {showFilters && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* RANGE */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Range
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip
                label="Current"
                active={optimisticRange === "FM"}
                pending={isPending && pendingRange === "FM"}
                onClick={() => setRange("FM")}
              />
              <Chip
                label="Previous"
                active={optimisticRange === "PREVIOUS"}
                pending={isPending && pendingRange === "PREVIOUS"}
                onClick={() => setRange("PREVIOUS")}
              />
              <Chip
                label="3 FM"
                active={optimisticRange === "3FM"}
                pending={isPending && pendingRange === "3FM"}
                onClick={() => setRange("3FM")}
              />
              <Chip
                label="12 FM"
                active={optimisticRange === "12FM"}
                pending={isPending && pendingRange === "12FM"}
                onClick={() => setRange("12FM")}
              />
            </div>
          </div>

          {/* CLASS */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Class
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip
                label="P4P"
                active={optimisticClass === "P4P"}
                pending={isPending && pendingClass === "P4P"}
                onClick={() => setClass("P4P")}
              />
              <Chip
                label="SMART"
                active={optimisticClass === "SMART"}
                pending={isPending && pendingClass === "SMART"}
                onClick={() => setClass("SMART")}
              />
              <Chip
                label="TECH"
                active={optimisticClass === "TECH"}
                pending={isPending && pendingClass === "TECH"}
                onClick={() => setClass("TECH")}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}