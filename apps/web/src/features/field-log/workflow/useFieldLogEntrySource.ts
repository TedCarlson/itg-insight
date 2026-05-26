"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { readShellRoleHint } from "@/shared/navigation/resolveNavigationRole";
import type { FieldLogEntrySource } from "./fieldLogWorkflow.types";

export function useFieldLogEntrySource(): FieldLogEntrySource {
  const pathname = usePathname();

  return useMemo(() => {
    if (pathname === "/tech/field-log" || pathname.startsWith("/tech/field-log/")) {
      return "TECH";
    }

    const shellRole = readShellRoleHint();

    if (shellRole) {
      return shellRole;
    }

    return "UNKNOWN";
  }, [pathname]);
}
