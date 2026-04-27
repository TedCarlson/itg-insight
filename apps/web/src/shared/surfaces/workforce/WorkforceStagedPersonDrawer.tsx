// path: apps/web/src/shared/surfaces/workforce/WorkforceStagedPersonDrawer.tsx

"use client";

import type { WorkforcePersonSearchRow } from "./WorkforceAddPersonDrawer";

type Props = {
    person: WorkforcePersonSearchRow | null;
    onClose: () => void;
    onCreate: (person: WorkforcePersonSearchRow) => void;
};

export function WorkforceStagedPersonDrawer({
    person,
    onClose,
    onCreate,
}: Props) {
    if (!person) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
            <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Intended Workforce Addition
                        </div>
                        <h2 className="mt-1 text-lg font-semibold">
                            {person.full_name ?? "Unknown Person"}
                        </h2>
                        <div className="mt-1 text-sm text-muted-foreground">
                            {person.tech_id ? `Tech ID: ${person.tech_id}` : "No Tech ID"}
                            {person.position_title ? ` • ${person.position_title}` : ""}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border px-3 py-1.5 text-sm"
                    >
                        Close
                    </button>
                </div>

                <div className="mt-5 rounded-2xl border p-4">
                    <div className="text-sm font-semibold">Staged Add</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        This person exists and is not active in this workforce. Next step
                        creates the workforce assignment/profile draft.
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <dt className="text-muted-foreground">Person ID</dt>
                            <dd className="break-all">{person.person_id}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Current State</dt>
                            <dd>
                                {person.active_elsewhere_label
                                    ? `Active elsewhere: ${person.active_elsewhere_label}`
                                    : "No active workforce assignment"}
                            </dd>
                        </div>
                    </dl>

                    <button
                        type="button"
                        onClick={() => onCreate(person)}
                        className="mt-4 rounded-xl border border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] px-3 py-2 text-sm"
                    >
                        Create Workforce Assignment Pending
                    </button>
                </div>
            </aside>
        </div>
    );
}