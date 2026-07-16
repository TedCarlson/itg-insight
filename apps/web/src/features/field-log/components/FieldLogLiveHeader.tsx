"use client";

import { RotateCw } from "lucide-react";

type FieldLogLiveHeaderProps = {
  eyebrow?: string;
  title: string;
  freshnessText: string;
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
};

export function FieldLogLiveHeader(props: FieldLogLiveHeaderProps) {
  const { eyebrow = "Field Log", title, freshnessText, refreshing, onRefresh } = props;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="flex items-baseline gap-2">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        <span className="text-xs text-muted-foreground">{eyebrow}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{freshnessText}</span>

        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
        >
          <RotateCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </header>
  );
}
