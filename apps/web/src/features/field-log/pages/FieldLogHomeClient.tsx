"use client";

import Link from "next/link";

export function hasManagerUpFieldLogAccess(accessPass: any) {
  if (!accessPass) return false;
  if (accessPass.is_admin || accessPass.is_app_owner || accessPass.is_owner) return true;

  const haystack = [
    ...(Array.isArray(accessPass.permissions) ? accessPass.permissions : []),
    ...(Array.isArray(accessPass.roles) ? accessPass.roles : []),
    accessPass.role,
    accessPass.role_key,
    accessPass.title,
    accessPass.position_title,
    accessPass.relationship_type,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return haystack.some(
    (value) =>
      value.includes("manager") ||
      value.includes("director") ||
      value.includes("vp") ||
      value.includes("owner") ||
      value.includes("admin"),
  );
}

function Tile(props: { href: string; title: string; description: string }) {
  return (
    <Link
      href={props.href}
      className="rounded-2xl border bg-card p-4 transition hover:bg-muted/40"
    >
      <div className="text-base font-semibold">{props.title}</div>
      <div className="mt-2 text-sm text-muted-foreground">{props.description}</div>
    </Link>
  );
}

export function FieldLogHomeClient() {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <Tile
        href="/field-log/new"
        title="New Field Log"
        description="Start a new field submission."
      />

      <Tile
        href="/field-log/mine"
        title="My Work"
        description="View your drafts, pending logs, follow-ups, and approvals."
      />
    </section>
  );
}
