import Link from "next/link";

export const runtime = "nodejs";

function NavButton(props: { href: string; title: string; desc?: string }) {
  return (
    <Link
      href={props.href}
      className="rounded border p-4 text-left hover:bg-[var(--to-surface-2)]"
      style={{ borderColor: "var(--to-border)" }}
    >
      <div className="text-sm font-semibold">{props.title}</div>
      {props.desc ? (
        <div className="mt-1 text-sm text-[var(--to-ink-muted)]">
          {props.desc}
        </div>
      ) : null}
    </Link>
  );
}

export default function AdminHomePage() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-[var(--to-ink-muted)]">
          Internal tools for managing access and platform data.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <NavButton
          href="/admin/edge-permissions"
          title="Edge permissions"
          desc="Grant/revoke admin + delegation permissions (global + PC-ORG)."
        />
        <NavButton
          href="/admin/org-users"
          title="Org users"
          desc="User membership and org-scoped access."
        />
        <NavButton
          href="/admin/leadership"
          title="Leadership"
          desc="Leadership assignments and controls."
        />
        <NavButton
          href="/admin/catalogue"
          title="Admin catalogue"
          desc="Manage core tables and foundational data."
        />
      </div>
    </div>
  );
}