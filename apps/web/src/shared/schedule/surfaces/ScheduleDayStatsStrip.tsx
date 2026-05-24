// path: apps/web/src/shared/schedule/surfaces/ScheduleDayStatsStrip.tsx

"use client";

import type {
  ScheduleSurfaceRow,
} from "../types/scheduleSurfaceTypes";

type Props = {
  rows: ScheduleSurfaceRow[];
};

type Bucket = {
  eight: number;
  ten: number;
  other: number;
  total: number;
};

function emptyBucket(): Bucket {
  return {
    eight: 0,
    ten: 0,
    other: 0,
    total: 0,
  };
}

function add(bucket: Bucket, units: number | null) {
  if (units == null) return;

  bucket.total += 1;

  if (units === 96) {
    bucket.eight += 1;
    return;
  }

  if (units === 120) {
    bucket.ten += 1;
    return;
  }

  bucket.other += 1;
}

function build(rows: ScheduleSurfaceRow[]) {
  const planned = emptyBucket();
  const built = emptyBucket();
  const actual = emptyBucket();

  for (const row of rows) {
    add(planned, row.routeLock.plannedUnits);
    add(built, row.routeLock.builtUnits);
    add(actual, row.routeLock.actualUnits);
  }

  return {
    planned,
    built,
    actual,
  };
}

function Segment({
  label,
  bucket,
  dashWhenEmpty = false,
}: {
  label: string;
  bucket: Bucket;
  dashWhenEmpty?: boolean;
}) {
  if (dashWhenEmpty && bucket.total === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-semibold">—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-semibold">{bucket.total}</span>
      <span className="text-muted-foreground">•</span>
      <span>8h {bucket.eight}</span>
      <span className="text-muted-foreground">•</span>
      <span>10h {bucket.ten}</span>
      <span className="text-muted-foreground">•</span>
      <span>Other {bucket.other}</span>
    </div>
  );
}

export default function ScheduleDayStatsStrip({
  rows,
}: Props) {
  const stats = build(rows);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-background px-4 py-2 text-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Shift Load
      </div>

      <Segment label="Planned" bucket={stats.planned} dashWhenEmpty />
      <Segment label="Built" bucket={stats.built} />
      <Segment label="Actual" bucket={stats.actual} />
    </div>
  );
}
