"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useFieldLogRuntime } from "../hooks/useFieldLogRuntime";
import { useSession } from "@/state/session";
import { useOrg } from "@/state/org";
import { useAccessPass } from "@/state/access";
import { SubjectTechPicker } from "../components/SubjectTechPicker";
import type { TechSearchRow } from "../hooks/useTechSearch";
import { useFieldLogEntrySource } from "../workflow/useFieldLogEntrySource";

type DraftResponse = {
  ok: boolean;
  reportId?: string;
  error?: string;
};

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const CONDUIT_PULL_CATEGORY_KEY = "conduit_pull_install";

function isConduitPullCategory(categoryKey: string | null) {
  return categoryKey === CONDUIT_PULL_CATEGORY_KEY;
}

function requiredPhotoCountForCategory(categoryKey: string | null, fallback: number) {
  if (isConduitPullCategory(categoryKey)) return 5;
  return fallback;
}

function canAssignSubjectTech(accessPass: any) {
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
      value.includes("manage") ||
      value.includes("supervisor") ||
      value.includes("lead") ||
      value.includes("itg supervisor") ||
      value.includes("bp lead") ||
      value.includes("manager") ||
      value.includes("owner") ||
      value === "roster_view" ||
      value === "dispatch_view" ||
      value === "metrics_view" ||
      value === "route_lock_view",
  );
}

function StepHeader(props: {
  step: number;
  title: string;
  subtitle?: string | null;
}) {
  const { step, title, subtitle } = props;

  return (
    <div className="mb-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Step {step}
      </div>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
    </div>
  );
}

function ChoiceTile(props: {
  selected: boolean;
  title: string;
  subtitle?: string | null;
  onClick: () => void;
}) {
  const { selected, title, subtitle, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "w-full rounded-2xl border p-4 text-left transition",
        "hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        selected
          ? "border-blue-500 bg-blue-50 shadow-sm"
          : "border-border bg-card",
      )}
    >
      <div className="font-semibold">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
    </button>
  );
}

export default function FieldLogNewClient() {
  const { categories, getSubcategoriesForCategory, getRuleForSelection } =
    useFieldLogRuntime();

  const { userId } = useSession();
  const { selectedOrgId } = useOrg();
  const { accessPass } = useAccessPass();
  const entrySource = useFieldLogEntrySource();

  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [subcategoryKey, setSubcategoryKey] = useState<string | null>(null);
  const [jobNumber, setJobNumber] = useState("");
  const [jobType, setJobType] = useState<"install" | "tc" | "sro" | "">("");
  const [creating, setCreating] = useState(false);

  const [techQuery, setTechQuery] = useState("");
  const [selectedTech, setSelectedTech] = useState<TechSearchRow | null>(null);

  const subcategories = getSubcategoriesForCategory(categoryKey);
  const rule = getRuleForSelection(categoryKey, subcategoryKey);
  const conduitPullMode = isConduitPullCategory(categoryKey);
  const jobTypeLocked = conduitPullMode;
  const displayedPhotoCount = requiredPhotoCountForCategory(categoryKey, rule?.min_photo_count ?? 0);

  const showSubjectTechPicker = useMemo(() => {
    if (entrySource === "TECH") return false;
    return true;
  }, [entrySource]);

  async function createDraft() {
    if (!categoryKey) return;
    if (!jobNumber.trim()) return;

    if (!userId) {
      alert("No signed-in user found.");
      return;
    }

    if (!selectedOrgId) {
      alert("Please select a PC scope before creating a Field Log.");
      return;
    }

    if (showSubjectTechPicker && !selectedTech) {
      alert("Select the technician this Field Log belongs to.");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/field-log/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          createdByUserId: userId,
          pcOrgId: selectedOrgId,
          categoryKey,
          subcategoryKey,
          jobNumber: jobNumber.trim(),
          jobType: jobType || null,
          subjectPersonId: selectedTech?.person_id ?? null,
          subjectFullName: selectedTech?.full_name ?? null,
          subjectTechId: selectedTech?.tech_id ?? null,
        }),
      });

      const json = (await res.json()) as DraftResponse;

      if (!json.ok || !json.reportId) {
        alert(json.error || "Failed to create draft.");
        return;
      }

      window.location.href = `/field-log/draft/${json.reportId}`;
    } finally {
      setCreating(false);
    }
  }

  const continueDisabled =
    !categoryKey ||
    !jobNumber.trim() ||
    !jobType ||
    creating ||
    (showSubjectTechPicker && !selectedTech);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-sm font-semibold">Start a Field Log</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Follow the steps below to create a new submission.
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <StepHeader
          step={1}
          title="Choose submission type"
          subtitle="Select the type of field activity you are reporting."
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {categories.map((cat) => (
            <ChoiceTile
              key={cat.category_key}
              selected={categoryKey === cat.category_key}
              title={cat.label}
              subtitle={cat.description ?? null}
              onClick={() => {
                setCategoryKey(cat.category_key);
                setSubcategoryKey(null);
                setJobType(isConduitPullCategory(cat.category_key) ? "install" : "");
              }}
            />
          ))}
        </div>
      </section>

      {subcategories.length > 0 ? (
        <section className="rounded-2xl border bg-card p-4">
          <StepHeader
            step={2}
            title="Choose reason"
            subtitle="Select the specific reason that applies to this submission."
          />

          <div className="grid gap-3">
            {subcategories.map((s) => (
              <ChoiceTile
                key={s.subcategory_key}
                selected={subcategoryKey === s.subcategory_key}
                title={s.label}
                onClick={() => setSubcategoryKey(s.subcategory_key)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {showSubjectTechPicker ? (
        <section className="rounded-2xl border bg-card p-4">
          <StepHeader
            step={subcategories.length > 0 ? 3 : 2}
            title="Choose technician"
            subtitle="Select the technician this Field Log belongs to."
          />

          <SubjectTechPicker
            enabled={showSubjectTechPicker}
            pcOrgId={selectedOrgId}
            query={techQuery}
            selectedTech={selectedTech}
            onQueryChange={(value) => {
              setTechQuery(value);
              setSelectedTech(null);
            }}
            onSelect={(row) => {
              setSelectedTech(row);
              setTechQuery(`${row.full_name ?? "Unknown"} • Tech ID: ${row.tech_id ?? "—"}`);
            }}
            onClear={() => {
              setSelectedTech(null);
              setTechQuery("");
            }}
          />
        </section>
      ) : null}

      <section className="rounded-2xl border bg-card p-4">
        <StepHeader
          step={showSubjectTechPicker ? (subcategories.length > 0 ? 4 : 3) : subcategories.length > 0 ? 3 : 2}
          title="Choose job type and enter job number"
          subtitle="Complete the job details before continuing."
        />

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {([
              { key: "install", label: "INSTALL" },
              { key: "tc", label: "TC" },
              { key: "sro", label: "SRO" },
            ] as const).map((type) => (
              <ChoiceTile
                key={type.key}
                selected={jobType === type.key}
                title={type.label}
                onClick={() => {
                  if (jobTypeLocked) return;
                  setJobType(type.key);
                }}
              />
            ))}
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Job Number</div>
            <input
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
              placeholder="Enter job number"
              className="w-full rounded-xl border px-3 py-3"
            />
          </div>
        </div>
      </section>

      {rule ? (
        <section className="rounded-2xl border bg-muted/30 p-4 text-sm">
          <div className="font-semibold">Submission requirements</div>

          <div className="mt-3 space-y-1 text-muted-foreground">
            <div>
              Photos required: <span className="font-medium text-foreground">{displayedPhotoCount}</span>
            </div>
            {rule.xm_allowed ? (
              <div>
                XM evidence: <span className="font-medium text-foreground">Allowed</span>
              </div>
            ) : null}
            {rule.comment_required ? (
              <div>
                Comment: <span className="font-medium text-foreground">Required</span>
              </div>
            ) : null}
            {rule.location_required ? (
              <div>
                Location: <span className="font-medium text-foreground">Required</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-4">
        <Button
          variant="primary"
          disabled={continueDisabled}
          onClick={() => void createDraft()}
          className="w-full px-4 py-4 text-base font-semibold disabled:opacity-60"
        >
          {creating ? "Creating…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}