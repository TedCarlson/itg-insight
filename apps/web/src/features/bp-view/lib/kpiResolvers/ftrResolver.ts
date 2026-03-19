import { supabaseAdmin } from "@/shared/data/supabase/admin";

export async function resolveFtrByTech(params: {
  techIds: string[];
  pcOrgIds: string[];
  range: "FM" | "3FM" | "12FM";
}) {
  const admin = supabaseAdmin();

  const { data } = await admin
    .from("metrics_raw_row")
    .select("tech_id,fiscal_end_date,metric_date,batch_id,raw")
    .in("tech_id", params.techIds)
    .in("pc_org_id", params.pcOrgIds)
    .order("fiscal_end_date", { ascending: false })
    .order("metric_date", { ascending: false });

  const map = new Map<string, number | null>();

  for (const row of data ?? []) {
    const techId = String(row.tech_id ?? "");
    if (!techId) continue;

    // basic extraction (same as your tech payload)
    const raw = typeof row.raw === "string" ? JSON.parse(row.raw) : row.raw;

    const contact =
      Number(raw?.["Total FTR/Contact Jobs"] ?? raw?.["ftr_contact_jobs"]) || 0;

    const fails =
      Number(raw?.["FTRFailJobs"] ?? raw?.["ftr_fail_jobs"]) || 0;

    if (contact > 0) {
      const ftr = 100 * (1 - fails / contact);
      map.set(techId, ftr);
    } else {
      map.set(techId, null);
    }
  }

  return map;
}