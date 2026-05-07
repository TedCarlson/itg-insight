// path: apps/web/src/shared/surfaces/reports/OnboardingReportLauncher.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  OnboardingReportModal,
  type OnboardingReportRow,
} from "./OnboardingReportModal";

type Props = {
  regionLabel: string;
  reportMonthLabel: string;
  scopedAffiliations?: string[];
};

function normalizeAffiliation(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function OnboardingReportLauncher({
  regionLabel,
  reportMonthLabel,
  scopedAffiliations = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<OnboardingReportRow[]>([]);

  const scopedAffiliationSet = useMemo(() => {
    return new Set(
      scopedAffiliations
        .map((affiliation) => normalizeAffiliation(affiliation))
        .filter(Boolean)
    );
  }, [scopedAffiliations]);

  useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      try {
        const res = await fetch("/api/people/onboarding", {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (cancelled) return;

        setRows(res.ok ? json?.rows ?? [] : []);
      } catch {
        if (!cancelled) setRows([]);
      }
    }

    loadCount();

    return () => {
      cancelled = true;
    };
  }, []);

  const scopedRows = useMemo(() => {
    if (!scopedAffiliationSet.size) return rows;

    return rows.filter((row) =>
      scopedAffiliationSet.has(normalizeAffiliation(row.affiliation))
    );
  }, [rows, scopedAffiliationSet]);

  const onboardingCount = useMemo(() => {
    return scopedRows.filter((row) => row.status === "onboarding").length;
  }, [scopedRows]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "rounded-xl border px-4 py-2 text-sm transition",
          onboardingCount > 0
            ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_12%,white)] text-[var(--to-ink)]"
            : "bg-muted/30 text-muted-foreground",
        ].join(" ")}
      >
        Onboarding ({onboardingCount})
      </button>

      <OnboardingReportModal
        open={open}
        rows={scopedRows}
        onClose={() => setOpen(false)}
        regionLabel={regionLabel}
        reportMonthLabel={reportMonthLabel}
      />
    </>
  );
}