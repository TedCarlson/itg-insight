"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Toolbar } from "@/components/ui/Toolbar";

import type { KpiDef } from "@/features/metrics/lib/reports/kpis";
import type { RubricRow } from "@/features/metrics-reports/lib/score";

import { RubricOverlay } from "@/features/metrics/components/reports/RubricOverlay";

type Preset = Record<string, any>;

type Props = {
  title: string;
  subtitle?: string;
  preset: Preset;
  rubricRows: RubricRow[];
  kpis: KpiDef[];
  classType: string;
  rightHref?: string; // optional escape hatch (kept)
};

export default function ReportsClientShell({
  title,
  subtitle,
  preset,
  rubricRows,
  kpis,
  classType,
  rightHref,
}: Props) {
  const [rubricOpen, setRubricOpen] = useState(false);

  const hasRubric = useMemo(() => (rubricRows?.length ?? 0) > 0, [rubricRows]);

  return (
    <>
      <Card variant="subtle">
        <Toolbar
          left={
            <div className="min-w-0 flex items-center gap-2">
              <Link
                href="/metrics/uploads"
                className="to-btn to-btn--secondary h-8 px-3 text-xs inline-flex items-center"
              >
                Uploads
              </Link>

              <span className="px-2 text-[var(--to-ink-muted)]">•</span>

              <div className="min-w-0">
                <div className="text-sm font-semibold leading-5">{title}</div>
                {subtitle ? (
                  <div className="text-[11px] text-[var(--to-ink-muted)] leading-4">
                    {subtitle}
                  </div>
                ) : null}
              </div>
            </div>
          }
          right={
            <div className="flex items-center gap-2">
              {rightHref ? (
                <Link href={rightHref} className="text-sm underline">
                  Rubric &amp; Band Styles
                </Link>
              ) : (
                <button
                  type="button"
                  className="to-btn to-btn--secondary h-8 px-3 text-xs inline-flex items-center"
                  onClick={() => setRubricOpen(true)}
                  disabled={!hasRubric}
                  title={hasRubric ? "View rubric" : "No rubric rows found for this class"}
                >
                  Rubric
                </button>
              )}
            </div>
          }
        />
      </Card>

      <RubricOverlay
        open={rubricOpen}
        onOpenChange={setRubricOpen}
        preset={preset}
        rubricRows={rubricRows}
        kpis={kpis}
        classType={classType}
      />
    </>
  );
}