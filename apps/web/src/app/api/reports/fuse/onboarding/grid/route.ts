import { NextResponse } from "next/server";
import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";

const STATUS_GROUPS = {
  started: ["Started"],
  background: [
    "DT Pass/Pending BG",
    "Pending D&B",
    "Pending DT/BG Pass",
    "Drug & Background Sent",
  ],
  badge: ["Badge/Creds Submitted", "Ready for Badge/Creds"],
  consent: ["Consent Forms Pending Return"],
  inactive: ["Not Hiring", "Not Qualified", "Terminated"],
} as const;

type StatusGroupKey = keyof typeof STATUS_GROUPS | "history";

type SortKey =
  | "fuse_date"
  | "contractor"
  | "candidate"
  | "tech"
  | "status"
  | "updated"
  | "history"
  | "id";

type SortDirection = "asc" | "desc";

function parseSortKey(value: string | null): SortKey | null {
  if (
    value === "fuse_date" ||
    value === "contractor" ||
    value === "candidate" ||
    value === "tech" ||
    value === "status" ||
    value === "updated" ||
    value === "history" ||
    value === "id"
  ) {
    return value;
  }

  return null;
}

function parseSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

function clampPageSize(value: string | null) {
  const n = Number(value ?? 25);
  if (!Number.isFinite(n)) return 25;
  return Math.max(10, Math.min(100, Math.floor(n)));
}

function pageOffset(page: string | null, pageSize: number) {
  const n = Number(page ?? 1);
  const safePage = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
  return (safePage - 1) * pageSize;
}

function parseGroups(value: string | null): StatusGroupKey[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is StatusGroupKey =>
      item === "started" ||
      item === "background" ||
      item === "badge" ||
      item === "consent" ||
      item === "inactive" ||
      item === "history"
    );
}

function statusValuesForGroups(groups: StatusGroupKey[]) {
  return groups.flatMap((group) =>
    group === "history" ? [] : [...STATUS_GROUPS[group]]
  );
}

export async function GET(req: Request) {
  const scope = await requireSelectedPcOrgServer();

  if (!scope.ok) {
    return NextResponse.json({ error: "No selected PC org" }, { status: 400 });
  }

  const sb = await supabaseServer();
  const { searchParams } = new URL(req.url);

  const pageSize = clampPageSize(searchParams.get("pageSize"));
  const from = pageOffset(searchParams.get("page"), pageSize);
  const to = from + pageSize - 1;
  const groups = parseGroups(searchParams.get("groups"));
  const sortKey = parseSortKey(searchParams.get("sort"));
  const sortDirection = parseSortDirection(searchParams.get("direction"));

  const { data: pcOrg, error: pcOrgError } = await sb
    .from("pc_org")
    .select("pc_org_name")
    .eq("pc_org_id", scope.selected_pc_org_id)
    .maybeSingle();

  if (pcOrgError) {
    return NextResponse.json({ error: pcOrgError.message }, { status: 500 });
  }

  const pcOrgMatch = String(pcOrg?.pc_org_name ?? "").match(/\b(\d{3})\b/);
  const pcOrgNumber = pcOrgMatch?.[1] ?? "";

  if (!pcOrgNumber) {
    return NextResponse.json(
      { error: "Selected PC org name does not include a 3-digit PC code" },
      { status: 400 }
    );
  }

  let query = sb
    .from("fuse_onboarding_candidate_current_v")
    .select("*", { count: "exact" })
    .ilike("office_text", `${pcOrgNumber}-%`);

  const ascending = sortDirection === "asc";

  if (sortKey === "fuse_date") {
    query = query
      .order("row_date", { ascending, nullsFirst: false })
      .order("company_name", { ascending: true })
      .order("display_name", { ascending: true });
  } else if (sortKey === "contractor") {
    query = query
      .order("company_name", { ascending, nullsFirst: false })
      .order("display_name", { ascending: true });
  } else if (sortKey === "candidate") {
    query = query
      .order("display_name", { ascending, nullsFirst: false })
      .order("company_name", { ascending: true });
  } else if (sortKey === "tech") {
    query = query
      .order("tech_id", { ascending, nullsFirst: false })
      .order("display_name", { ascending: true });
  } else if (sortKey === "status") {
    query = query
      .order("raw->>Status", { ascending, nullsFirst: false })
      .order("display_name", { ascending: true });
  } else if (sortKey === "updated") {
    query = query
      .order("raw->>Status Update", { ascending, nullsFirst: false })
      .order("display_name", { ascending: true });
  } else if (sortKey === "history") {
    query = query
      .order("snapshot_count", { ascending, nullsFirst: false })
      .order("display_name", { ascending: true });
  } else if (sortKey === "id") {
    query = query
      .order("personnel_id", { ascending, nullsFirst: false })
      .order("display_name", { ascending: true });
  } else {
    query = query
      .order("company_name", { ascending: true })
      .order("display_name", { ascending: true });
  }

  query = query.range(from, to);

  const statusValues = statusValuesForGroups(groups);
  const wantsHistory = groups.includes("history");

  if (statusValues.length && wantsHistory) {
    query = query.or(
      `raw->>Status.in.(${statusValues.join(",")}),snapshot_count.gt.1`
    );
  } else if (statusValues.length) {
    query = query.in("raw->>Status", statusValues);
  } else if (wantsHistory) {
    query = query.gt("snapshot_count", 1);
  }

  const q = searchParams.get("q");
  if (q) {
    query = query.or(
      `display_name.ilike.%${q}%,company_name.ilike.%${q}%,tech_id.ilike.%${q}%,personnel_id.ilike.%${q}%`
    );
  }

  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) query = query.gte("row_date", dateFrom);

  const dateTo = searchParams.get("dateTo");
  if (dateTo) query = query.lte("row_date", dateTo);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let countQuery = sb
    .from("fuse_onboarding_candidate_current_v")
    .select("raw,snapshot_count", { count: "exact" })
    .ilike("office_text", `${pcOrgNumber}-%`);

  const { data: countRows, error: countError } = await countQuery;

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const rowsForCounts = countRows ?? [];
  const statusOf = (row: { raw: Record<string, unknown> | null }) =>
    String(row.raw?.Status ?? "");

  const counts = {
    all: rowsForCounts.length,
    started: rowsForCounts.filter((row) =>
      STATUS_GROUPS.started.includes(statusOf(row) as "Started")
    ).length,
    background: rowsForCounts.filter((row) =>
      (STATUS_GROUPS.background as readonly string[]).includes(statusOf(row))
    ).length,
    badge: rowsForCounts.filter((row) =>
      (STATUS_GROUPS.badge as readonly string[]).includes(statusOf(row))
    ).length,
    consent: rowsForCounts.filter((row) =>
      STATUS_GROUPS.consent.includes(
        statusOf(row) as "Consent Forms Pending Return"
      )
    ).length,
    inactive: rowsForCounts.filter((row) =>
      (STATUS_GROUPS.inactive as readonly string[]).includes(statusOf(row))
    ).length,
    history: rowsForCounts.filter((row) => Number(row.snapshot_count ?? 0) > 1)
      .length,
  };

  return NextResponse.json({
    rows: data ?? [],
    count: count ?? 0,
    counts,
    pageSize,
    from,
    to,
  });
}
