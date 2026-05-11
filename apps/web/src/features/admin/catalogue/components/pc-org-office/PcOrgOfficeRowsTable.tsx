// path: apps/web/src/features/admin/catalogue/components/pc-org-office/PcOrgOfficeRowsTable.tsx

"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import type { PcOrgOfficeAdminRow } from "@/features/admin/catalogue/hooks/usePcOrgOfficeAdmin";
import { labelOrId, shortId } from "./pcOrgOfficeDisplay";

type Props = {
  rows: PcOrgOfficeAdminRow[];
  loading: boolean;
  pageIndex: number;
  pageSize: number;
  totalRows?: number;
  canPrev: boolean;
  canNext: boolean;
  onEdit: (row: PcOrgOfficeAdminRow) => void;
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

export default function PcOrgOfficeRowsTable({
  rows,
  loading,
  pageIndex,
  pageSize,
  canPrev,
  canNext,
  onEdit,
  onPageIndexChange,
  onPageSizeChange,
}: Props) {
  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title="No links found"
        message="Try adjusting your search, or add a new link."
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
              <th className="whitespace-nowrap px-3 py-2">Office</th>
              <th className="whitespace-nowrap px-3 py-2">UUID</th>
              <th className="whitespace-nowrap px-3 py-2 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const pcOrgLabel = labelOrId(row.pc_org_name, row.pc_org_id);

              const officeLabel =
                row.office_name && row.office_code
                  ? `${row.office_name} (${row.office_code})`
                  : labelOrId(
                      row.office_name ?? row.office_code,
                      row.office_id
                    );

              return (
                <tr
                  key={row.pc_org_office_id}
                  className={
                    index % 2 === 1
                      ? "bg-[var(--to-surface)]"
                      : "bg-[var(--to-surface-soft)]"
                  }
                >
                  <td className="px-3 py-2">
                    <div className="grid">
                      <div className="font-medium">{pcOrgLabel}</div>
                      <div className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.pc_org_id)}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="grid">
                      <div className="font-medium">{officeLabel}</div>
                      <div className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.office_id)}
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--to-ink-muted)]">
                        {shortId(row.pc_org_office_id)}
                      </span>
                      <CopyUuidButton value={row.pc_org_office_id} />
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