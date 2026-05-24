// path: apps/web/src/shared/layouts/OperationalPageShell.tsx

"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  controls?: ReactNode;
  rightRail?: ReactNode;
};

export default function OperationalPageShell({
  title,
  children,
  controls,
  rightRail,
}: Props) {
  return (
    <div className="space-y-3">

      <div className="flex items-center justify-between gap-4 rounded-xl border bg-background px-3 py-2">

        <div className="min-w-0">
          <div className="text-xl font-semibold tracking-tight">
            {title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {controls}
          {rightRail}
        </div>

      </div>

      {children}

    </div>
  );
}
