"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type {
  CompanyManagerSegment,
  CompanyManagerViewMode,
} from "../lib/companyManagerView.types";

type Props = {
  activeMode: CompanyManagerViewMode;
  activeSegment: CompanyManagerSegment;
};

function SegButton(props: {
  active: boolean;
  label: string;
  pending?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.pending}
      className={[
        "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition",
        props.active
          ? "border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)] text-[var(--to-primary)]"
          : "border-[var(--to-border)] bg-card text-muted-foreground hover:bg-muted/20",
        props.pending ? "opacity-80" : "",
      ].join(" ")}
    >
      {props.label}
    </button>
  );
}

export default function CompanyManagerControlBar({
  activeMode,
  activeSegment,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParams(next: {
    mode?: CompanyManagerViewMode;
    segment?: CompanyManagerSegment;
  }) {
    startTransition(() => {
      const qs = new URLSearchParams(searchParams.toString());

      if (next.mode) {
        if (next.mode === "WORKFORCE") qs.delete("mode");
        else qs.set("mode", next.mode);
      }

      if (next.segment) {
        if (next.segment === "ALL") qs.delete("segment");
        else qs.set("segment", next.segment);
      }

      const href = qs.toString()
        ? `?${qs.toString()}`
        : window.location.pathname;

      router.push(href);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_oklab,var(--to-primary)_72%,black)]">
            Manager View Controls
          </div>
          <div className="text-xs text-muted-foreground">
            Switch between office, leadership, and workforce surfaces without
            leaving the manager view.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegButton
            active={activeMode === "OFFICE"}
            pending={isPending}
            label="Office"
            onClick={() => updateParams({ mode: "OFFICE" })}
          />
          <SegButton
            active={activeMode === "LEADERSHIP"}
            pending={isPending}
            label="Leadership"
            onClick={() => updateParams({ mode: "LEADERSHIP" })}
          />
          <SegButton
            active={activeMode === "WORKFORCE"}
            pending={isPending}
            label="Workforce"
            onClick={() => updateParams({ mode: "WORKFORCE" })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Segment
        </div>

        <SegButton
          active={activeSegment === "ALL"}
          pending={isPending}
          label="All"
          onClick={() => updateParams({ segment: "ALL" })}
        />
        <SegButton
          active={activeSegment === "ITG"}
          pending={isPending}
          label="ITG"
          onClick={() => updateParams({ segment: "ITG" })}
        />
        <SegButton
          active={activeSegment === "BP"}
          pending={isPending}
          label="BP"
          onClick={() => updateParams({ segment: "BP" })}
        />
      </div>
    </div>
  );
}