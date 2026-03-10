"use client";

import { useState } from "react";
import { useFieldLogRuntime } from "../hooks/useFieldLogRuntime";

type DraftResponse = {
  ok: boolean;
  reportId?: string;
  error?: string;
};

export default function FieldLogNewClient() {
  const {
    categories,
    getSubcategoriesForCategory,
    getRuleForSelection,
  } = useFieldLogRuntime();

  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [subcategoryKey, setSubcategoryKey] = useState<string | null>(null);

  const [jobNumber, setJobNumber] = useState("");
  const [jobType, setJobType] = useState<"install" | "tc" | "sro" | "">("");

  const [creating, setCreating] = useState(false);

  const subcategories = getSubcategoriesForCategory(categoryKey);
  const rule = getRuleForSelection(categoryKey, subcategoryKey);

  async function createDraft() {
    if (!categoryKey) return;
    if (!jobNumber) return;

    setCreating(true);

    try {
      const res = await fetch("/api/field-log/draft", {
        method: "POST",
        body: JSON.stringify({
          createdByUserId: "CURRENT_USER_ID", // wire to session later
          categoryKey,
          subcategoryKey,
          jobNumber,
          jobType,
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

      {/* CATEGORY */}
      <section>
        <h2 className="text-lg font-semibold mb-2">What are you reporting?</h2>

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
              {cat.description && (
                <div className="text-xs text-muted-foreground">
                  {cat.description}
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* SUBCATEGORY */}
      {subcategoryKey !== undefined && subcategories.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Reason</h2>

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
      )}

      {/* JOB INFO */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Job Info</h2>

        <input
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder="Job Number"
          className="w-full rounded-lg border p-3"
        />

        <div className="flex gap-2">
          {["install", "tc", "sro"].map((type) => (
            <button
              key={type}
              onClick={() => setJobType(type as any)}
              className={`flex-1 rounded-lg border p-3 ${
                jobType === type ? "border-blue-600 bg-blue-50" : ""
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      {/* RULE PREVIEW */}
      {rule && (
        <section className="rounded-xl border p-4 text-sm bg-gray-50">
          {rule.active_text_instruction && (
            <div className="mb-2">{rule.active_text_instruction}</div>
          )}

          <div>
            Photos required: <b>{rule.min_photo_count}</b>
          </div>

          {rule.xm_allowed && (
            <div className="text-xs text-muted-foreground">
              XM evidence allowed
            </div>
          )}
        </section>
      )}

      {/* CREATE DRAFT */}
      <button
        disabled={!categoryKey || !jobNumber || creating}
        onClick={createDraft}
        className="w-full rounded-xl bg-blue-600 text-white p-4 font-semibold"
      >
        {creating ? "Creating…" : "Continue"}
      </button>

    </div>
  );
}