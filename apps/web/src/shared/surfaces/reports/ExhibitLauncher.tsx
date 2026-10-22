// path: apps/web/src/shared/surfaces/reports/ExhibitLauncher.tsx

"use client";

import { useState } from "react";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import ExhibitModal from "./ExhibitModal";

type Props = {
  affiliations: WorkforceAffiliationOption[];
  regionLabel: string;
};

export function ExhibitLauncher({ affiliations, regionLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border px-4 py-2 text-sm"
      >
        Exhibit
      </button>

      <ExhibitModal
        open={open}
        affiliations={affiliations}
        regionLabel={regionLabel}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
