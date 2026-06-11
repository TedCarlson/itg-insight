"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccessPass } from "@/state/access";
import { hasManagerUpFieldLogAccess } from "../pages/FieldLogHomeClient";

export function FieldLogHeaderActions() {
  const { accessPass } = useAccessPass();
  const canViewNewDropPacket = useMemo(
    () => hasManagerUpFieldLogAccess(accessPass),
    [accessPass],
  );

  if (!canViewNewDropPacket) return null;

  return (
    <Link
      href="/field-log/new-drop-report"
      className="rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-muted/40"
    >
      New Drop Billing Packet
    </Link>
  );
}
