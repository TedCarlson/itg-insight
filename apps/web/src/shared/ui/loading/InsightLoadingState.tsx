// path: apps/web/src/shared/ui/loading/InsightLoadingState.tsx

import { InsightLoaderIcon } from "./InsightLoaderIcon";

type InsightLoadingStateProps = {
  title?: string;
  description?: string;
};

export function InsightLoadingState({
  title = "Loading Insight...",
  description = "Preparing your workspace.",
}: InsightLoadingStateProps) {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="text-blue-600">
          <InsightLoaderIcon size={140} />
        </div>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          {description}
        </p>

        <div className="mt-8 grid w-full gap-3">
          <div className="h-4 animate-pulse rounded bg-slate-200" />
          <div className="h-4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}