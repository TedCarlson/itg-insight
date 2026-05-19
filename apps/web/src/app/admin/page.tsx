import Link from "next/link";
import { supabaseAdmin } from "@/shared/data/supabase/admin";
import { getPersonRepairPayload } from "@/features/admin/person-repair/server/personRepair.service";

export const runtime = "nodejs";

async function loadPersonRepairCount() {
  try {
    const result = await getPersonRepairPayload(supabaseAdmin(), { limit: 1 });
    return result.ok ? result.summary.pending : 0;
  } catch {
    return 0;
  }
}

function NavButton(props: { href: string; title: string; desc?: string; count?: number }) {
  return (
    <Link
      href={props.href}
      className="rounded border p-4 text-left hover:bg-[var(--to-surface-2)]"
      style={{ borderColor: "var(--to-border)" }}
    >
      <div className="text-sm font-semibold">{props.title}</div>
      <div className="flex items-start justify-between gap-3">
        {props.desc ? <div className="mt-1 text-sm text-[var(--to-ink-muted)]">{props.desc}</div> : null}
        {typeof props.count === "number" && props.count > 0 ? (
          <span className="rounded-full border px-2 py-0.5 text-xs text-[var(--to-warning)]" style={{ borderColor: "var(--to-border)" }}>
            {props.count}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default async function AdminHomePage() {
  const personRepairCount = await loadPersonRepairCount();

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-[var(--to-ink-muted)]">Internal tools for managing access and platform data.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <NavButton href="/admin/home-editor" title="Home editor" desc="Customize the org homepage (per PC + LOB) using blocks." />
        <NavButton href="/admin/edge-permissions" title="Edge permissions" desc="Grant/revoke admin + delegation permissions (global + PC-ORG)." />
        <NavButton
          href="/admin/access"
          title="Profile access editor"
          desc="Edit profile access, org associations, and scoped permissions."
        />
        <NavButton
          href="/admin/person-repair"
          title="Person repair"
          desc="Heal person rows that block scoped view hydration."
          count={personRepairCount}
        />
        <NavButton href="/admin/leadership" title="Leadership" desc="Leadership assignments and controls." />
        <NavButton href="/admin/catalogue" title="Admin catalogue" desc="Manage core tables and foundational data." />
        <NavButton href="/admin/metrics" title="Metrics admin" desc="Manage metrics rubric and weighted scores." />
      </div>
    </div>
  );
}