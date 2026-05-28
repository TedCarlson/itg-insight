"use client";

import { useEffect, useState } from "react";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";

export type LookupOption = { id: string; label: string; sublabel?: string };

export type PcOrgDraft = {
  pc_org_name: string;
  fulfillment_center_id: string | null;
  fulfillment_center_name: string;
  pc_id: string | null;
  mso_id: string | null;
  division_id: string | null;
  region_id: string | null;
  state_code: string | null;
};

export function PcOrgForm(props: {
  value: PcOrgDraft;
  onChange: (next: PcOrgDraft) => void;

  pcOptions: LookupOption[];
  msoOptions: LookupOption[];
  divisionOptions: LookupOption[];
  regionOptions: LookupOption[];
  stateOptions: LookupOption[];
}) {
  const { value, onChange, pcOptions, msoOptions, divisionOptions, regionOptions, stateOptions } = props;

  // Local draft so we never call parent setState during render
  const [draft, setDraft] = useState<PcOrgDraft>(value);

  // When row changes (open drawer on different item), reset draft
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Push changes upward AFTER render
  useEffect(() => {
    onChange(draft);
  }, [draft, onChange]);

  const renderOptionLabel = (o: LookupOption) => (o.sublabel ? `${o.label} — ${o.sublabel}` : o.label);

  return (
    <div className="grid gap-4">
      <Field label="PC-ORG name">
        <TextInput
          value={draft.pc_org_name}
          onChange={(e: any) => setDraft((d) => ({ ...d, pc_org_name: String(e.target.value ?? "") }))}
          placeholder="e.g. 427"
        />
      </Field>

      <Field label="Fulfillment center">
        <TextInput
          value={draft.fulfillment_center_id ?? ""}
          onChange={(e: any) =>
            setDraft((d) => ({
              ...d,
              fulfillment_center_id: String(e.target.value ?? "").trim() || null,
            }))
          }
          placeholder="e.g. 189931101"
        />
      </Field>
      <Field label="Fulfillment center name">
        <TextInput
          value={draft.fulfillment_center_name}
          onChange={(e: any) =>
            setDraft((d) => ({ ...d, fulfillment_center_name: String(e.target.value ?? "") }))
          }
          placeholder="e.g. Pittsburgh"
        />
      </Field>  
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="PC">
          <Select
            value={draft.pc_id ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((d) => ({ ...d, pc_id: v ? v : null }));
            }}
          >
            <option value="">— Select —</option>
            {pcOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {renderOptionLabel(o)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="MSO">
          <Select
            value={draft.mso_id ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((d) => ({ ...d, mso_id: v ? v : null }));
            }}
          >
            <option value="">— Select —</option>
            {msoOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {renderOptionLabel(o)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Division">
          <Select
            value={draft.division_id ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((d) => ({ ...d, division_id: v ? v : null }));
            }}
          >
            <option value="">— Select —</option>
            {divisionOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {renderOptionLabel(o)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Region">
          <Select
            value={draft.region_id ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((d) => ({ ...d, region_id: v ? v : null }));
            }}
          >
            <option value="">— Select —</option>
            {regionOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {renderOptionLabel(o)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="State">
          <Select
            value={draft.state_code ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((d) => ({ ...d, state_code: v ? v : null }));
            }}
          >
            <option value="">— Select —</option>
            {stateOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {renderOptionLabel(o)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="text-xs text-[var(--to-ink-muted)]">
        Note: <span className="font-mono">pc_org_id</span> (UUID) is system-owned and cannot be edited.
      </div>
    </div>
  );
}