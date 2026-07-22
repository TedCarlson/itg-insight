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
      value.includes("support") ||
      value.includes("manager") ||
      value.includes("director") ||
      value.includes("vp") ||
      value.includes("owner") ||
      value.includes("admin"),
  );
}

function Action(props: { href: string; title: string; description: string; primary?: boolean }) {
  return (
    <Link
      href={props.href}
      className={`flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 transition hover:bg-muted/40 ${
        props.primary ? "border-blue-300 bg-blue-50/60" : "bg-card"
      }`}
    >
      <span className="text-lg leading-none text-blue-600" aria-hidden="true">
        {props.primary ? "+" : "→"}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{props.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{props.description}</span>
      </span>
    </Link>
  );
}

export function FieldLogHomeClient() {
  return (
    <section className="grid gap-2 sm:grid-cols-2">
      <Action
        href="/field-log/new"
        title="New Field Log"
        description="Start a new field submission."
        primary
      />

      <Action
        href="/field-log/mine"
        title="My Work"
        description="View your drafts, pending logs, follow-ups, and approvals."
      />
    </section>
  );
}
