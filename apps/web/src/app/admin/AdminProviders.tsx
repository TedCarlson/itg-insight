// apps/web/src/app/admin/AdminProviders.tsx
"use client";

import * as React from "react";
import { AccessProvider } from "@/state/access";

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return <AccessProvider>{children}</AccessProvider>;
}