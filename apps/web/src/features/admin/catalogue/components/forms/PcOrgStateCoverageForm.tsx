"use client";

import { useMemo } from "react";

export type LookupOption = {
  id: string;
  label: string;
  sublabel?: string;
};

export type PcOrgStateCoverageDraft = {
  pc_org_id: string | null;
  state_code: string | null;
  is_primary: boolean;
  coverage_status: "active" | "inactive";
};

function normalize(v: string) {
  const s = v.trim();
  return s.length ? s : "";
}

export function PcOrgStateCoverageForm(props: {
  value: PcOrgStateCoverageDraft;
  onChange: (next: PcOrgStateCoverageDraft) => void;
  pcOrgOptions: LookupOption[];
  stateOptions: LookupOption[];
}) {
  const pcOrgOptions = useMemo(
    () => [{ id: "", label: "Select PC-ORG…" }, ...props.pcOrgOptions],
    [props.pcOrgOptions]
  );

  const stateOptions = useMemo(
    () => [{ id: "", label: "Select State…" }, ...props.stateOptions],
    [props.stateOptions]
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <div className="to-label">PC-ORG</div>
        <select
          className="to-select"
          value={props.value.pc_org_id ?? ""}
          onChange={(e) => {
            const id = normalize(e.target.value);
            props.onChange({ ...props.value, pc_org_id: id || null });
          }}
        >
          {pcOrgOptions.map((o) => (
            <option key={o.id || "__empty"} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1">
        <div className="to-label">State Coverage</div>
        <select
          className="to-select"
          value={props.value.state_code ?? ""}
          onChange={(e) => {
            const id = normalize(e.target.value);
            props.onChange({ ...props.value, state_code: id || null });
          }}
        >
          {stateOptions.map((o) => (
            <option key={o.id || "__empty"} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={props.value.is_primary}
          onChange={(e) => props.onChange({ ...props.value, is_primary: e.target.checked })}
        />
        Primary coverage state
      </label>

      <div className="grid gap-1">
        <div className="to-label">Status</div>
        <select
          className="to-select"
          value={props.value.coverage_status}
          onChange={(e) =>
            props.onChange({
              ...props.value,
              coverage_status: e.target.value === "inactive" ? "inactive" : "active",
            })
          }
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="text-xs text-[var(--to-ink-muted)]">
        State coverage is a child relationship for Locate reporting. PC-ORG remains the primary organization anchor.
      </div>
    </div>
  );
}
