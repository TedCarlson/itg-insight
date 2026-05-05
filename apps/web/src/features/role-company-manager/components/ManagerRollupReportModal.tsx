// path: apps/web/src/features/role-company-manager/components/ManagerRollupReportModal.tsx

"use client";

import ManagerRollupReportOverlay, {
  type RollupReportPayload,
} from "@/shared/components/metrics/RollupReportOverlay";

type Props = {
  open: boolean;
  loading: boolean;
  payload: RollupReportPayload | null;
  error: string | null;
  onClose: () => void;
};

export function ManagerRollupReportModal({
  open,
  loading,
  payload,
  error,
  onClose,
}: Props) {
  return (
    <ManagerRollupReportOverlay
      open={open}
      loading={loading}
      payload={payload}
      error={error}
      onClose={onClose}
    />
  );
}