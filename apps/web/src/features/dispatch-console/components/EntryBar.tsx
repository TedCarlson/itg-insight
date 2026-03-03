"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextInput } from "@/components/ui/TextInput";

import type { EntryType, WorkforceTab } from "../lib/types";

export function EntryBar(props: {
  workforceTab: WorkforceTab;

  entryType: EntryType;
  setEntryType: (v: EntryType) => void;

  message: string;
  setMessage: (v: string) => void;

  editing: boolean;
  canSubmit: boolean;

  onSubmit: () => void;
  onClearOrCancel: () => void;
}) {
  const entryOptionsScheduled = [
    { value: "CALL_OUT" as const, label: "Call Out" },
    { value: "ADD_IN" as const, label: "Add In" },
    { value: "BP_LOW" as const, label: "BP-Low" },
    { value: "INCIDENT" as const, label: "Incident" },
    { value: "TECH_MOVE" as const, label: "Tech Move" },
    { value: "NOTE" as const, label: "Note" },
  ];

  const entryOptionsNotScheduled = [
    { value: "ADD_IN" as const, label: "Add In" },
    { value: "NOTE" as const, label: "Note" },
  ];

  const options = props.workforceTab === "NOT_SCHEDULED" ? entryOptionsNotScheduled : entryOptionsScheduled;

  // Guardrail: edit is NOTE-only; type locked during edit
  const lockType = props.editing;

  return (
    <Card className="border" style={{ borderColor: "var(--to-border)" }}>
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={lockType ? "pointer-events-none opacity-60" : ""}>
            <SegmentedControl<EntryType>
              value={props.entryType}
              onChange={(v) => {
                if (lockType) return;
                props.setEntryType(v);
              }}
              size="sm"
              options={options}
            />
          </div>

          <Button variant="secondary" className="h-9 px-3" onClick={props.onClearOrCancel}>
            {props.editing ? "Cancel" : "Clear"}
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1">
            <TextInput
              value={props.message}
              onChange={(e) => props.setMessage(e.target.value)}
              placeholder={props.editing ? "Edit the note…" : "Type the dispatch note…"}
            />
          </div>

          <Button onClick={props.onSubmit} disabled={!props.canSubmit} className="h-9 px-4">
            {props.editing ? "Save" : "Add"}
          </Button>
        </div>

        {props.editing ? (
          <div className="mt-2 text-xs text-[var(--to-ink-muted)]">Editing NOTE only • type is locked • creator-only</div>
        ) : null}
      </div>
    </Card>
  );
}