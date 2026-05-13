// path: apps/web/src/features/role-bp-owner/lib/filterBpOwnerTechHistoryParams.server.ts

import { resolveBpOwnerScope } from "./resolveBpOwnerScope.server";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function filterBpOwnerTechHistoryParams(args: {
  techId?: string | null;
}) {
  const requestedTechId = clean(args.techId);

  if (!requestedTechId) {
    return {
      allowed: true,
      techId: null,
    };
  }

  const scope = await resolveBpOwnerScope();

  const allowedTechIds = new Set(
    scope.scoped_assignments
      .map((row) => clean(row.tech_id))
      .filter(Boolean),
  );

  if (!allowedTechIds.has(requestedTechId)) {
    return {
      allowed: false,
      techId: null,
    };
  }

  return {
    allowed: true,
    techId: requestedTechId,
  };
}

export default filterBpOwnerTechHistoryParams;