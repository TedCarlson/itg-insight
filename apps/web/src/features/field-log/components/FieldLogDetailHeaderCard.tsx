"use client";

import { useEffect, useRef, useState } from "react";

type RulePopoverProps = {
  categoryLabel: string | null;
  categoryKey: string;
  subcategoryLabel: string | null;
  jobType: string | null;
  minPhotoCount?: number | null;
  xmAllowed?: boolean | null;
  commentRequired?: boolean | null;
  locationRequired?: boolean | null;
  toleranceMeters?: number | null;
  photoRequirements?: Array<{
    photo_label_key: string;
    label: string;
    required: boolean;
    sort_order: number;
  }> | null;
};

function fmtBoolWord(value: boolean | null | undefined, yes = "Yes", no = "No") {
  if (value == null) return "—";
  return value ? yes : no;
}

function fmtJobType(value: string | null | undefined) {
  if (!value) return null;
  return value.toUpperCase();
}

function useOutsideClose(
  open: boolean,
  refs: Array<React.RefObject<HTMLElement | null>>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedInside = refs.some((ref) => ref.current?.contains(target));
      if (!clickedInside) onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, refs, onClose]);
}

function RulePopover(props: RulePopoverProps) {
  const {
    categoryLabel,
    categoryKey,
    subcategoryLabel,
    jobType,
    minPhotoCount,
    xmAllowed,
    commentRequired,
    locationRequired,
    toleranceMeters,
    photoRequirements,
  } = props;

  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useOutsideClose(open, [buttonRef, popoverRef], () => setOpen(false));

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Show rule details"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold text-muted-foreground hover:bg-muted"
      >
        ⓘ
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className="
            absolute z-20 rounded-2xl border bg-card p-4 shadow-xl
            top-full left-0 mt-2 w-[min(320px,calc(100vw-2rem))]
            sm:top-0 sm:left-full sm:mt-0 sm:ml-2 sm:w-[280px]
          "
        >
          <div className="text-sm font-semibold">Rule Details</div>

          <div className="mt-3 space-y-2 text-sm">
            <div>
              Category: <span className="font-medium">{categoryLabel ?? categoryKey}</span>
            </div>

            {subcategoryLabel ? (
              <div>
                Subcategory: <span className="font-medium">{subcategoryLabel}</span>
              </div>
            ) : null}

            {jobType ? (
              <div>
                Job Type: <span className="font-medium">{fmtJobType(jobType)}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 border-t pt-3 text-sm">
            <div className="mb-2 font-medium">Requirements</div>
            <div className="space-y-2 text-muted-foreground">
              <div>
                Photos: <span className="text-foreground">{minPhotoCount ?? 0}</span>
              </div>
              <div>
                XM Allowed:{" "}
                <span className="text-foreground">
                  {fmtBoolWord(xmAllowed, "Allowed", "No")}
                </span>
              </div>
              <div>
                Comment:{" "}
                <span className="text-foreground">
                  {fmtBoolWord(commentRequired, "Required", "Optional")}
                </span>
              </div>
              <div>
                Location:{" "}
                <span className="text-foreground">
                  {fmtBoolWord(locationRequired, "Required", "Optional")}
                </span>
              </div>
              {toleranceMeters != null ? (
                <div>
                  Tolerance: <span className="text-foreground">{toleranceMeters}m</span>
                </div>
              ) : null}
            </div>
          </div>

          {photoRequirements && photoRequirements.length > 0 ? (
            <div className="mt-4 border-t pt-3 text-sm">
              <div className="mb-2 font-medium">Photo Requirements</div>
              <div className="space-y-1 text-muted-foreground">
                {photoRequirements.map((item) => (
                  <div key={item.photo_label_key}>
                    {item.label} • {item.required ? "required" : "optional"}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FieldLogDetailHeaderCard(props: {
  jobNumber: string;
  categoryLabel: string | null;
  categoryKey: string;
  subcategoryLabel: string | null;
  jobType: string | null;
  chipLabel: string;
  chipClassName: string;
  statusTitle: string;
  minPhotoCount?: number | null;
  xmAllowed?: boolean | null;
  commentRequired?: boolean | null;
  locationRequired?: boolean | null;
  toleranceMeters?: number | null;
  photoRequirements?: Array<{
    photo_label_key: string;
    label: string;
    required: boolean;
    sort_order: number;
  }> | null;
}) {
  const {
    jobNumber,
    categoryLabel,
    categoryKey,
    subcategoryLabel,
    jobType,
    chipLabel,
    chipClassName,
    minPhotoCount,
    xmAllowed,
    commentRequired,
    locationRequired,
    toleranceMeters,
    photoRequirements,
  } = props;

  return (
    <section className="rounded-2xl border bg-card p-5 overflow-visible">
      <div className="flex items-start justify-between gap-3 overflow-visible">
        <div className="min-w-0 overflow-visible">
          <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-visible">
            <span>Field Log</span>
            <RulePopover
              categoryLabel={categoryLabel}
              categoryKey={categoryKey}
              subcategoryLabel={subcategoryLabel}
              jobType={jobType}
              minPhotoCount={minPhotoCount}
              xmAllowed={xmAllowed}
              commentRequired={commentRequired}
              locationRequired={locationRequired}
              toleranceMeters={toleranceMeters}
              photoRequirements={photoRequirements ?? []}
            />
          </div>

          <div className="mt-1 text-2xl font-semibold leading-tight">{jobNumber}</div>

          <div className="mt-2 text-sm text-muted-foreground">
            {categoryLabel ?? categoryKey}
            {jobType ? ` • ${fmtJobType(jobType)}` : ""}
            {subcategoryLabel ? ` • ${subcategoryLabel}` : ""}
          </div>
        </div>

        <div
          className={`inline-flex min-w-[44px] items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold ${chipClassName}`}
        >
          {chipLabel}
        </div>
      </div>
    </section>
  );
}