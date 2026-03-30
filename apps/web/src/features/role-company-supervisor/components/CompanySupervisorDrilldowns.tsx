"use client";

import { useState } from "react";

import CompanySupervisorWorkMixCard from "./CompanySupervisorWorkMixCard";
import CompanySupervisorParityCard from "./CompanySupervisorParityCard";

import type { WorkMixSummary } from "@/shared/kpis/engine/buildWorkMixSummary";
import type { ParityRow } from "@/shared/kpis/engine/buildParityRows";

type Props = {
  work_mix: WorkMixSummary;
  parityRows: ParityRow[];
};

function Overlay(props: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { title, onClose, children } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12">
      <div className="max-h-[85vh] w-full max-w-7xl overflow-auto rounded-2xl border bg-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
          <div className="text-sm font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function TriggerButton(props: {
  label: string;
  helper: string;
  onClick: () => void;
}) {
  const { label, helper, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[72px] w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-left transition hover:bg-muted/20"
    >
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{helper}</div>
      </div>

      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm text-muted-foreground">
        i
      </div>
    </button>
  );
}

export default function CompanySupervisorDrilldowns({
  work_mix,
  parityRows,
}: Props) {
  const [openPanel, setOpenPanel] = useState<"work_mix" | "parity" | null>(
    null
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TriggerButton
          label="Work Mix"
          helper="Open work mix distribution overlay"
          onClick={() => setOpenPanel("work_mix")}
        />

        <TriggerButton
          label="Parity"
          helper="Open contractor parity overlay"
          onClick={() => setOpenPanel("parity")}
        />
      </div>

      {openPanel === "work_mix" ? (
        <Overlay title="Work Mix" onClose={() => setOpenPanel(null)}>
          <CompanySupervisorWorkMixCard work_mix={work_mix} />
        </Overlay>
      ) : null}

      {openPanel === "parity" ? (
        <Overlay title="Parity" onClose={() => setOpenPanel(null)}>
          <CompanySupervisorParityCard rows={parityRows} />
        </Overlay>
      ) : null}
    </>
  );
}