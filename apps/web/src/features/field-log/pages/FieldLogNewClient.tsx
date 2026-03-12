"use client";

import { useMemo, useState } from "react";
import { useFieldLogRuntime } from "../hooks/useFieldLogRuntime";
import { useSession } from "@/state/session";
import { useOrg } from "@/state/org";
import { useAccessPass } from "@/state/access";
import { SubjectTechPicker } from "../components/SubjectTechPicker";
import type { TechSearchRow } from "../hooks/useTechSearch";

type DraftResponse = {
  ok: boolean;
  reportId?: string;
  error?: string;
};

function canAssignSubjectTech(accessPass: any) {
  if (!accessPass) return false;
  if (accessPass.is_admin || accessPass.is_app_owner || accessPass.is_owner) return true;

  const perms = accessPass.permissions ?? [];
  return perms.some(
    (p: string) =>
      p.includes("manage") ||
      p === "roster_view" ||
      p === "dispatch_view" ||
      p === "metrics_view" ||
      p === "route_lock_view",
  );
}

export default function FieldLogNewClient() {
  const { categories, getSubcategoriesForCategory, getRuleForSelection } =
    useFieldLogRuntime();

  const { userId } = useSession();
  const { selectedOrgId } = useOrg();
  const { accessPass } = useAccessPass();

  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [subcategoryKey, setSubcategoryKey] = useState<string | null>(null);

  const [jobNumber, setJobNumber] = useState("");
  const [jobType, setJobType] = useState<"install" | "tc" | "sro" | "">("");
  const [creating, setCreating] = useState(false);

  const [techQuery, setTechQuery] = useState("");
  const [selectedTech, setSelectedTech] = useState<TechSearchRow | null>(null);

  const subcategories = getSubcategoriesForCategory(categoryKey);
  const rule = getRuleForSelection(categoryKey, subcategoryKey);

  const showSubjectTechPicker = useMemo(() => {
    return canAssignSubjectTech(accessPass);
  }, [accessPass]);

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

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold">What are you reporting?</h2>

        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.category_key}
              onClick={() => {
                setCategoryKey(cat.category_key);
                setSubcategoryKey(null);
              }}
              className={`rounded-xl border p-4 text-left ${
                categoryKey === cat.category_key
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200"
              }`}
            >
              <div className="font-semibold">{cat.label}</div>
              {cat.description ? (
                <div className="text-xs text-muted-foreground">{cat.description}</div>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {subcategories.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Reason</h2>

          <div className="grid gap-2">
            {subcategories.map((s) => (
              <button
                key={s.subcategory_key}
                onClick={() => setSubcategoryKey(s.subcategory_key)}
                className={`rounded-xl border p-3 text-left ${
                  subcategoryKey === s.subcategory_key
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Job Info</h2>

        <input
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder="Job Number"
          className="w-full rounded-lg border p-3"
        />

        <div className="flex gap-2">
          {(["install", "tc", "sro"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setJobType(type)}
              className={`flex-1 rounded-lg border p-3 ${
                jobType === type ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      {rule ? (
        <section className="rounded-xl border bg-gray-50 p-4 text-sm">
          {rule.active_text_instruction ? (
            <div className="mb-2">{rule.active_text_instruction}</div>
          ) : null}

          <div>
            Photos required: <b>{rule.min_photo_count}</b>
          </div>

          {rule.xm_allowed ? (
            <div className="text-xs text-muted-foreground">XM evidence allowed</div>
          ) : null}
        </section>
      ) : null}

      <button
        disabled={
          !categoryKey ||
          !jobNumber.trim() ||
          creating ||
          (showSubjectTechPicker && !selectedTech)
        }
        onClick={() => void createDraft()}
        className="w-full rounded-xl bg-blue-600 p-4 font-semibold text-white disabled:opacity-60"
      >
        {creating ? "Creating…" : "Continue"}
      </button>
    </div>
  );
}