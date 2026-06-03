"use client";

import { useMemo, useState } from "react";
import { useOrg } from "@/state/org";
import { SubjectTechPicker } from "./SubjectTechPicker";
import type { TechSearchRow } from "../hooks/useTechSearch";

type FieldLogReassignFollowupCardProps = {
  busy: boolean;
  status: string | null | undefined;
  currentOwnerPersonId?: string | null;
  currentOwnerLabel?: string | null;
  note: string;
  onNoteChange: (value: string) => void;
  onReassign: (personId: string) => void | Promise<void>;
};

export function FieldLogReassignFollowupCard(props: FieldLogReassignFollowupCardProps) {
  const {
    busy,
    status,
    currentOwnerPersonId,
    currentOwnerLabel,
    note,
    onNoteChange,
    onReassign,
  } = props;

  const { selectedOrgId } = useOrg();
  const [query, setQuery] = useState("");
  const [selectedTech, setSelectedTech] = useState<TechSearchRow | null>(null);

  const canShow =
    status === "tech_followup_required" || status === "sup_followup_required";

  const blocked = useMemo(() => {
    if (!selectedTech?.person_id) return true;
    if (selectedTech.person_id === currentOwnerPersonId) return true;
    return false;
  }, [currentOwnerPersonId, selectedTech]);

  if (!canShow) return null;

  const selectedLabel = selectedTech
    ? `${selectedTech.tech_id ? `${selectedTech.tech_id} • ` : ""}${selectedTech.full_name}`
    : null;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="text-base font-semibold">Reassign Follow-Up</div>

      <div className="mt-2 text-sm text-muted-foreground">
        Move ownership of this unresolved follow-up without closing the report.
      </div>

      {currentOwnerLabel || currentOwnerPersonId ? (
        <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-sm">
          <div className="font-medium">Current Owner</div>
          <div className="mt-1 text-muted-foreground">
            {currentOwnerLabel ?? currentOwnerPersonId}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <SubjectTechPicker
          enabled={!!selectedOrgId}
          pcOrgId={selectedOrgId}
          query={query}
          selectedTech={selectedTech}
          onQueryChange={setQuery}
          onSelect={setSelectedTech}
          onClear={() => {
            setSelectedTech(null);
            setQuery("");
          }}
        />
      </div>

      {selectedLabel ? (
        <div className="mt-2 text-sm text-muted-foreground">
          New owner: <span className="font-medium text-foreground">{selectedLabel}</span>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="text-sm font-medium">Assignment Note</div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Optional context for why this follow-up is being reassigned…"
          rows={3}
          className="w-full rounded-xl border px-3 py-3"
        />
      </div>

      <button
        type="button"
        disabled={busy || blocked}
        onClick={() => selectedTech?.person_id && void onReassign(selectedTech.person_id)}
        className="mt-4 w-full rounded-xl border px-4 py-3 font-semibold disabled:opacity-60"
      >
        Reassign Follow-Up
      </button>
    </section>
  );
}
