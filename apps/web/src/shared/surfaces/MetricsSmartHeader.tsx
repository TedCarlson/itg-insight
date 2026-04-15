// path: apps/web/src/shared/surfaces/MetricsSmartHeader.tsx

"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export type MetricsSmartHeaderRangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

export type MetricsSmartHeaderModel = {
    role_label?: string | null;
    rep_full_name?: string | null;
    division_label?: string | null;
    org_display?: string | null;
    pc_label?: string | null;
    scope_headcount?: number | null;
    total_headcount?: number | null;
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

function buildContextLine(parts: Array<string | null | undefined>) {
    return parts.filter(Boolean).join(" • ");
}

function InlineSpinner() {
    return (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
    );
}

function RangeChip(props: MetricsSmartHeaderRangeOption) {
    return (
        <button
            type="button"
            onClick={props.onClick}
            disabled={props.pending || !props.onClick}
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

export default function MetricsSmartHeader(props: Props) {
    const { header, rangeOptions = [], showFilters = false } = props;

    const contextLine = buildContextLine([
        header.division_label,
        header.org_display,
        header.pc_label,
    ]);

    return (
        <Card className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {header.role_label ?? "Metrics View"}
                    </div>

                    <div className="mt-1 text-2xl font-semibold tracking-tight">
                        {header.rep_full_name ?? "—"}
                    </div>

                    {contextLine ? (
                        <div className="mt-2 text-sm text-muted-foreground">
                            {contextLine}
                        </div>
                    ) : null}
                </div>

                <div className="flex items-start gap-3">
                    <div className="grid grid-cols-3 gap-2">
                        <StatTile
                            label="TOTAL HC"
                            value={header.scope_headcount ?? 0}
                        />
                        <StatTile
                            label="SCOPE HC"
                            value={header.total_headcount ?? 0}
                        />
                        <StatTile
                            label="As Of"
                            value={formatAsOfDate(header.as_of_date)}
                        />
                    </div>

                    {props.onToggleFilters ? (
                        <button
                            type="button"
                            onClick={props.onToggleFilters}
                            className="h-[42px] rounded-xl border px-3 text-sm font-medium hover:bg-muted/30"
                        >
                            Filters
                        </button>
                    ) : null}

                    {props.rightActions}
                </div>
            </div>

            {showFilters ? (
                <div className="mt-4 space-y-4">
                    {rangeOptions.length > 0 ? (
                        <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Range
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {rangeOptions.map((option) => (
                                    <RangeChip
                                        key={option.key}
                                        label={option.label}
                                        active={option.active}
                                        pending={option.pending}
                                        onClick={option.onClick}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {props.filtersContent}
                </div>
            ) : null}
        </Card>
    );
}