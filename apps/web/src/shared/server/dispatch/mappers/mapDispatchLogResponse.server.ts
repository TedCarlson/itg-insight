import type { DispatchLogResponseRow, DispatchLogSelectRow, SupabaseAdminClient } from "../types/dispatchLog.types";
import { loadDispatchUserLabels } from "../loaders/loadDispatchUserLabels.server";

export async function mapDispatchLogRowsForResponse(
  admin: SupabaseAdminClient,
  rows: DispatchLogSelectRow[],
): Promise<DispatchLogResponseRow[]> {
  const nameMap = await loadDispatchUserLabels(
    admin,
    rows.map((row) => String(row.created_by_user_id ?? "")),
  );

  return rows.map((row) => ({
    ...row,
    created_by_name: nameMap.get(String(row.created_by_user_id ?? "")) ?? null,
  }));
}

export async function mapDispatchLogRowForResponse(
  admin: SupabaseAdminClient,
  row: DispatchLogSelectRow,
): Promise<DispatchLogResponseRow> {
  const rows = await mapDispatchLogRowsForResponse(admin, [row]);
  return rows[0];
}