// RUN THIS
// Replace the entire file:
// apps/web/src/app/not-ready/page.tsx

import Link from "next/link";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const runtime = "nodejs";

export default function NotReadyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-6">
        <div className="text-2xl font-semibold">Profile not ready</div>
        <div className="mt-1 text-sm text-[var(--to-ink-muted)]">
          Your account is authenticated, but your org/profile setup isn’t complete yet.
        </div>
      </div>

      <div
        className="rounded-2xl border bg-[var(--to-surface)] p-5 shadow-sm"
        style={{ borderColor: "var(--to-border)" }}
      >
        <p className="text-sm text-[var(--to-ink-muted)]">
          If you believe this is a mistake, contact your administrator to finish provisioning your profile and assign an
          organization.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login" className={cls("to-btn", "to-btn--secondary", "px-4 py-3", "text-center")}>
            Back to login
          </Link>

          <Link href="/auth/signout" className={cls("to-btn", "to-btn--secondary", "px-4 py-3", "text-center")}>
            Sign out
          </Link>

          <Link href="/admin" className={cls("to-btn", "to-btn--secondary", "px-4 py-3", "text-center")}>
            Admin
          </Link>
        </div>
      </div>

      <div
        className="mt-4 rounded-2xl border bg-[var(--to-surface)] p-5 shadow-sm"
        style={{ borderColor: "var(--to-border)" }}
      >
        <p className="text-sm text-[var(--to-ink-muted)]">
          Next step: once your org exists for the target LOB, you’ll be able to select it from the header and proceed.
        </p>
      </div>
    </div>
  );
}