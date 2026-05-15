// apps/web/src/app/(app)/roster/page.tsx

import Link from "next/link";

export default function RetiredRosterPage() {
    return (
        <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6">
            <section className="rounded-2xl border border-[var(--to-border)] bg-[var(--to-surface)] p-8 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
                    Legacy Surface Retired
                </p>

                <h1 className="mt-3 text-2xl font-semibold text-[var(--to-text)]">
                    Roster has been retired
                </h1>

                <p className="mt-3 text-sm leading-6 text-[var(--to-muted)]">
                    The legacy Roster view is no longer part of the supported application
                    workflow. Workforce is now the controlled staffing and assignment
                    surface.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="rounded-xl bg-[var(--to-primary)] px-4 py-2 text-sm font-semibold text-white"
                    >
                        Go Back
                    </button>

                    <Link
                        href="/home"
                        className="rounded-xl border border-[var(--to-border)] px-4 py-2 text-sm font-semibold text-[var(--to-text)]"
                    >
                        Go Home
                    </Link>
                </div>
            </section>
        </main>
    );
}