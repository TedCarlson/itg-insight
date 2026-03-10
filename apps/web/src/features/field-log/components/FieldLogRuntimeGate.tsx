"use client";

import type { ReactNode } from "react";
import { useFieldLogRuntime } from "../hooks/useFieldLogRuntime";

export function FieldLogRuntimeGate(props: { children: ReactNode }) {
  const { children } = props;
  const { loading, error } = useFieldLogRuntime();

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Loading Field Log…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return <>{children}</>;
}