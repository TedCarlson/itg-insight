// path: apps/web/src/features/role-bp-lead/pages/BpLeadMetricsPageShell.tsx

import BpOwnerMetricsPageShell from "@/features/role-bp-owner/pages/BpOwnerMetricsPageShell";

type Props = {
  range?: string;
  class_type?: "NSR" | "SMART";
};

export default function BpLeadMetricsPageShell(props: Props) {
  return (
    <BpOwnerMetricsPageShell
      range={props.range}
      class_type={props.class_type ?? "NSR"}
    />
  );
}