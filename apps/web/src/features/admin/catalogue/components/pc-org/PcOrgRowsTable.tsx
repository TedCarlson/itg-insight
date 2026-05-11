// path: apps/web/src/features/admin/catalogue/components/pc-org/PcOrgRowsTable.tsx

"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import type { PcOrgAdminRow } from "@/features/admin/catalogue/hooks/usePcOrgAdmin";
import { labelOrId, shortId } from "./pcOrgDisplay";

type Props = {
  rows: PcOrgAdminRow[];
  loading: boolean;
  pageIndex: number;
  pageSize: number;
  totalRows?: number;
  canPrev: boolean;
  canNext: boolean;
  onEdit: (row: PcOrgAdminRow) => void;
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
};

function CopyUuidButton(props: { value: string }) {
  return (
    <button
      type="button"
      className="to-btn inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: "var(--to-border)" }}
      onClick={async () => {
        await navigator.clipboard.writeText(String(props.value));
      }}
      title="Copy UUID"
    >
      Copy
    </button>
  );
}

export default function PcOrgRowsTable({
  rows,
  loading,
  pageIndex,
  pageSize,
  totalRows,
  canPrev,
  canNext,
  onEdit,
  onPageIndexChange,
  onPageSizeChange,
}: Props) {
  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title="No PC-ORGs found"
        message="Try adjusting your search."
        compact
      />
    );
  }

  return (
    <>
      <div
        className="overflow-auto rounded border"
        style={{ borderColor: "var(--to-border)" }}
      >
        <table className="w-full text-sm">
          <thead className="bg-[var(--to-surface-2)]">
            <tr className="text-left">
              <th className="whitespace-nowrap px-3 py-2">PC-ORG</th>
              <th className="whitespace-nowrap px-3 py-2">FC</th>
              <th className="whitespace-nowrap px-3 py-2">PC</th>
              <th className="whitespace-nowrap px-3 py-2">MSO</th>
              <th className="whitespace-nowrap px-3 py-2">Division</th>
              <th className="whitespace-nowrap px-3 py-2">Region</th>
              <th className="whitespace-nowrap px-3 py-2">UUID</th>
              <th className="whitespace-nowrap px-3 py-2 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const anyRow = row as any;

              const fcLabel = labelOrId(
                row.fulfillment_center_name,
                row.fulfillment_center_id
              );

              const pcLabel =
                anyRow.pc_number != null
                  ? `PC ${anyRow.pc_number}`
                  : labelOrId(anyRow.pc_name, row.pc_id);

              const msoLabel = labelOrId(anyRow.mso_name, row.mso_id);

              const divisionLabel =
                anyRow.division_name && anyRow.division_code
                  ? `${anyRow.division_name} (${anyRow.division_code})`
                  : labelOrId(
                      anyRow.division_name ?? anyRow.division_code,
                      row.division_id
                    );

              const regionLabel =
                anyRow.region_name && anyRow.region_code
                  ? `${anyRow.region_name} (${anyRow.region_code})`
                  : labelOrId(
                      anyRow.region_name ?? anyRow.region_code,
                      row.region_id
                    );

              return (
                <tr
                  key={row.pc_org_id}
                  className={
                    index % 2 === 1
                      ? "bg-[var(--to-surface)]"
                      : "bg-[var(--to-surface-soft)]"
                  }
                >
                  <td className="px-3 py-2 font-medium">
                    <div className="grid">
                      <div>{row.pc_org_name ?? "—"}</div>
                      <div className="text-xs text-[var(--to-ink-muted)]">
                        {fcLabel}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="grid">
                      <div className="text-sm">{fcLabel}</div>
                      <div className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.fulfillment_center_id)}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="grid">
                      <div className="text-sm">{pcLabel}</div>
                      <div className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.pc_id)}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="grid">
                      <div className="text-sm">{msoLabel}</div>
                      <div className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.mso_id)}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="grid">
                      <div className="text-sm">{divisionLabel}</div>
                      <div className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.division_id)}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="grid">
                      <div className="text-sm">{regionLabel}</div>
                      <div className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.region_id)}
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.pc_org_id)}
                      </span>
                      <CopyUuidButton value={row.pc_org_id} />
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      className="to-btn inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
                      style={{ borderColor: "var(--to-border)" }}
                      onClick={() => onEdit(row)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[var(--to-ink-muted)]">
          Page {(pageIndex + 1).toString()}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded border bg-transparent px-2 text-sm"
            style={{ borderColor: "var(--to-border)" }}
          >
            {[10, 25, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}/page
              </option>
            ))}
          </select>

          <button
            type="button"
            className="h-9 rounded border px-3 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
            onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}
            disabled={!canPrev || loading}
          >
            Prev
          </button>

          <button
            type="button"
            className="h-9 rounded border px-3 text-sm font-medium"
            style={{ borderColor: "var(--to-border)" }}
            onClick={() => onPageIndexChange(pageIndex + 1)}
            disabled={!canNext || loading}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}