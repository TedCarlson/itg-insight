// path: apps/web/src/shared/surfaces/MetricsSmartHeader.tsx

"use client";

import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Card } from "@/components/ui/Card";

export type MetricsSmartHeaderRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

export type MetricsSmartHeaderModel = {
  role_label?: string | null;
  rep_full_name?: string | null;
  division_label?: string | null;
  org_display?: string | null;
  pc_label?: string | null;
  total_headcount?: number | null;
  scope_headcount?: number | null;
  as_of_date?: string | null;
};

export type MetricsSmartHeaderRangeOption = {
  key: MetricsSmartHeaderRangeKey;
  label: string;
  active?: boolean;
  pending?: boolean;
  onClick?: () => void;
};

type Props = {
  header: MetricsSmartHeaderModel;
  scopeLabel?: string | null;
  rangeOptions?: MetricsSmartHeaderRangeOption[];
  showFilters?: boolean;
  onToggleFilters?: () => void;
  filtersContent?: ReactNode;
  rightActions?: ReactNode;
};

function formatAsOfDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function StatInline(props: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-2 rounded-xl border bg-card px-3 py-2">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="text-sm font-semibold leading-none">{props.value}</div>
    </div>
  );
}

function splitRightActions(rightActions: ReactNode): {
  classOptions: ReactNode | null;
  rangeOptions: ReactNode | null;
  fallback: ReactNode | null;
} {
  if (!isValidElement(rightActions)) {
    return {
      classOptions: null,
      rangeOptions: null,
      fallback: rightActions ?? null,
    };
  }

  const element = rightActions as ReactElement<{ children?: ReactNode }>;
  const innerChildren = Children.toArray(element.props.children);

  if (innerChildren.length >= 2) {
    return {
      classOptions: innerChildren[1] ?? null,
      rangeOptions: innerChildren[0] ?? null,
      fallback: null,
    };
  }

  return {
    classOptions: null,
    rangeOptions: null,
    fallback: rightActions,
  };
}

export default function MetricsSmartHeader(props: Props) {
  const { header, scopeLabel, rightActions, showFilters = false } = props;

  const orgLabel = String(header.org_display ?? "Org").trim() || "Org";
  const { classOptions, rangeOptions, fallback } = splitRightActions(rightActions);

  return (
    <Card className="p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_auto_auto_auto] xl:items-center">
        {/* col 1: manager */}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {header.role_label ?? "Metrics View"}
          </div>
          <div className="mt-1 text-xl font-semibold leading-tight">
            {header.rep_full_name ?? "—"}
          </div>
        </div>

        {/* col 2: class */}
        <div className="flex items-center xl:justify-start">
          {classOptions}
        </div>

        {/* col 3: range */}
        <div className="flex items-center xl:justify-start">
          {rangeOptions}
        </div>

        {/* col 4: hc + as of */}
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <StatInline
            label={`HC ${orgLabel}`}
            value={header.total_headcount ?? 0}
          />

          {scopeLabel && header.scope_headcount !== null ? (
            <StatInline
              label={`HC ${scopeLabel}`}
              value={header.scope_headcount ?? 0}
            />
          ) : null}

          <StatInline
            label="As Of"
            value={formatAsOfDate(header.as_of_date)}
          />
        </div>
      </div>

      {fallback ? <div className="mt-3">{fallback}</div> : null}

      {showFilters ? <div className="mt-4">{props.filtersContent}</div> : null}
    </Card>
  );
}