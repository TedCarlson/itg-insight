// path: apps/web/src/features/admin/catalogue/components/user-profile/UserProfileRowsTable.tsx

"use client";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cls, type UserProfileRow } from "./userProfileTypes";

type Props = {
  rows: UserProfileRow[];
  loading: boolean;
  selectedAuthUserId: string | null;
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  canPrev: boolean;
  canNext: boolean;
  onSelect: (authUserId: string) => void;
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
};

export default function UserProfileRowsTable({
  rows,
  loading,
  selectedAuthUserId,
  pageIndex,
  pageSize,
  totalRows,
  canPrev,
  canNext,
  onSelect,
  onPageIndexChange,
  onPageSizeChange,
}: Props) {
  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title="No profiles found"
        message="Try adjusting your search."
        compact
      />
    );
  }

  return (
    <div>
      <div
        className="overflow-auto rounded border"
        style={{ borderColor: "var(--to-border)" }}
      >
        <table className="w-full text-sm">
          <thead className="bg-[var(--to-surface-2)]">
            <tr className="text-left">
              <th className="whitespace-nowrap px-3 py-2">Email / Auth</th>
              <th className="whitespace-nowrap px-3 py-2">Core Person</th>
              <th className="whitespace-nowrap px-3 py-2">Status</th>
              <th className="whitespace-nowrap px-3 py-2">Selected Org</th>
              <th className="whitespace-nowrap px-3 py-2">Admin</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const active = selectedAuthUserId === row.auth_user_id;

              return (
                <tr
                  key={row.auth_user_id}
                  className={cls(
                    index % 2 === 1
                      ? "bg-[var(--to-surface)]"
                      : "bg-[var(--to-surface-soft)]",
                    active && "ring-2 ring-[var(--to-focus)]"
                  )}
                >
                  <td className="px-3 py-2 align-top">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onSelect(row.auth_user_id)}
                    >
                      <div className="font-medium">{row.email ?? "—"}</div>
                      <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">
                        {row.auth_user_id}
                      </div>
                    </button>
                  </td>

                  <td className="px-3 py-2 align-top">
                    <div>{row.core_person_full_name ?? "—"}</div>
                    <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">
                      {row.core_person_id ?? "—"}
                    </div>
                    {row.legacy_person_id ? (
                      <div className="mt-1 text-[10px] text-[var(--to-ink-muted)]">
                        Legacy: {row.legacy_person_id}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-3 py-2 align-top">
                    <Badge
                      variant={
                        row.status === "active"
                          ? "success"
                          : row.status === "inactive"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {row.status ?? "—"}
                    </Badge>
                  </td>

                  <td className="px-3 py-2 align-top">
                    <div>{row.selected_pc_org_name ?? "—"}</div>
                    <div className="font-mono text-[11px] text-[var(--to-ink-muted)]">
                      {row.selected_pc_org_id ?? "—"}
                    </div>
                  </td>

                  <td className="px-3 py-2 align-top">
                    {row.is_admin ? "Yes" : "No"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[var(--to-ink-muted)]">
          Page {(pageIndex + 1).toString()} • {totalRows} rows
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
    </div>
  );
}