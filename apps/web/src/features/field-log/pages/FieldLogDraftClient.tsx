"use client";

import { useMemo, useState } from "react";
import { useFieldLogRuntime } from "../hooks/useFieldLogRuntime";
import type { FieldLogRule } from "../lib/fieldLog.types";

type FieldLogDraftClientProps = {
  reportId: string;
  categoryKey: string;
  subcategoryKey: string | null;
  initialJobNumber: string;
  initialJobType: string | null;
};

type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
  errors?: string[];
};

type JobType = "install" | "tc" | "sro" | "";

type LocalPhoto = {
  id: string;
  fileName: string;
  filePath: string;
  photoLabelKey: string | null;
};

function makeFakePath(reportId: string, fileName: string) {
  return `field-log/${reportId}/${Date.now()}-${fileName}`;
}

function needsSubcategory(rule: FieldLogRule | null, subcategoryKey: string | null) {
  if (!rule) return false;
  if (!rule.require_subcategory) return false;
  return !subcategoryKey;
}

export default function FieldLogDraftClient(props: FieldLogDraftClientProps) {
  const { reportId, categoryKey, subcategoryKey, initialJobNumber, initialJobType } = props;
  const { getRuleForSelection } = useFieldLogRuntime();

  const rule = getRuleForSelection(categoryKey, subcategoryKey);

  const [jobNumber, setJobNumber] = useState(initialJobNumber);
  const [jobType, setJobType] = useState<JobType>(
    initialJobType === "install" || initialJobType === "tc" || initialJobType === "sro"
      ? initialJobType
      : "",
  );
  const [comment, setComment] = useState("");
  const [useXm, setUseXm] = useState(false);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requiredPhotoCount = rule?.min_photo_count ?? 0;
  const canUseXm = rule?.xm_allowed ?? false;
  const photoRequirements = rule?.photo_requirements ?? [];

  const photoCountText = useMemo(() => {
    return `${photos.length}/${requiredPhotoCount}`;
  }, [photos.length, requiredPhotoCount]);

  async function saveBaseFields() {
    const res = await fetch("/api/field-log/draft/base", {
      method: "POST",
      body: JSON.stringify({
        reportId,
        jobNumber: jobNumber.trim(),
        jobType: jobType || null,
        comment: comment.trim() || null,
        evidenceDeclared: useXm ? "xm_platform" : photos.length > 0 ? "field_upload" : "none",
        xmDeclared: useXm,
      }),
    });

    const json = (await res.json()) as ApiResponse;
    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Failed to save draft.");
    }
  }

  async function addAttachment(file: File, photoLabelKey: string | null) {
    const filePath = makeFakePath(reportId, file.name);

    const res = await fetch("/api/field-log/attachment", {
      method: "POST",
      body: JSON.stringify({
        reportId,
        photoLabelKey,
        filePath,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
      }),
    });

    const json = (await res.json()) as ApiResponse;
    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Failed to add attachment.");
    }

    setPhotos((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${file.name}`,
        fileName: file.name,
        filePath,
        photoLabelKey,
      },
    ]);
  }

  async function onPickFiles(
    e: React.ChangeEvent<HTMLInputElement>,
    photoLabelKey: string | null,
  ) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setSaving(true);
    try {
      if (useXm) {
        setUseXm(false);
      }

      await saveBaseFields();

      for (const file of files) {
        await addAttachment(file, photoLabelKey);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add photo.");
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  }

  async function onSubmit() {
    if (!rule) {
      alert("No active rule found for this draft.");
      return;
    }

    if (!jobNumber.trim()) {
      alert("Job number is required.");
      return;
    }

    if (needsSubcategory(rule, subcategoryKey)) {
      alert("Subcategory is required.");
      return;
    }

    if (rule.comment_required && !comment.trim()) {
      alert("Comment is required.");
      return;
    }

    if (!useXm && photos.length < requiredPhotoCount) {
      alert(`At least ${requiredPhotoCount} photo(s) required.`);
      return;
    }

    setSubmitting(true);
    try {
      await saveBaseFields();

      const res = await fetch("/api/field-log/submit", {
        method: "POST",
        body: JSON.stringify({
          reportId,
          comment: comment.trim() || null,
          evidenceDeclared: useXm ? "xm_platform" : photos.length > 0 ? "field_upload" : "none",
          xmDeclared: useXm,
        }),
      });

      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        const extra =
          json.errors && json.errors.length > 0 ? `\n\n${json.errors.join("\n")}` : "";
        throw new Error((json.error || "Failed to submit Field Log report.") + extra);
      }

      window.location.href = "/field-log";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-sm text-muted-foreground">Field Log Draft</div>
        <div className="mt-1 text-lg font-semibold">
          {rule?.category_label ?? categoryKey}
          {rule?.subcategory_label ? ` • ${rule.subcategory_label}` : ""}
        </div>
        {rule?.active_text_instruction ? (
          <div className="mt-2 text-sm text-muted-foreground">
            {rule.active_text_instruction}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="text-base font-semibold">Job Info</div>

        <input
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder="Job Number"
          className="w-full rounded-xl border px-3 py-3"
        />

        <div className="grid grid-cols-3 gap-2">
          {(["install", "tc", "sro"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setJobType(type)}
              className={`rounded-xl border px-3 py-3 text-sm font-medium ${
                jobType === type ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Evidence</div>
            <div className="text-sm text-muted-foreground">
              Photos required: <span className="font-medium text-foreground">{requiredPhotoCount}</span>
            </div>
          </div>
          <div className="text-sm font-medium">{photoCountText}</div>
        </div>

        {canUseXm ? (
          <button
            type="button"
            onClick={() => setUseXm((prev) => !prev)}
            className={`w-full rounded-xl border px-3 py-3 text-left ${
              useXm ? "border-blue-600 bg-blue-50" : "border-gray-200"
            }`}
          >
            <div className="font-medium">XM photos already uploaded</div>
            <div className="text-xs text-muted-foreground">
              Technician declares XM evidence now. Supervisor verifies later.
            </div>
          </button>
        ) : null}

        {!useXm ? (
          <div className="space-y-3">
            {photoRequirements.length > 0 ? (
              photoRequirements.map((item) => (
                <label
                  key={item.photo_label_key}
                  className="block rounded-xl border border-gray-200 px-3 py-3"
                >
                  <div className="font-medium">{item.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.required ? "Required" : "Optional"}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="mt-3 block w-full text-sm"
                    onChange={(e) => void onPickFiles(e, item.photo_label_key)}
                  />
                </label>
              ))
            ) : (
              <label className="block rounded-xl border border-gray-200 px-3 py-3">
                <div className="font-medium">Add Photo</div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="mt-3 block w-full text-sm"
                  onChange={(e) => void onPickFiles(e, null)}
                />
              </label>
            )}

            {photos.length > 0 ? (
              <div className="rounded-xl bg-muted/40 p-3 text-sm">
                <div className="mb-2 font-medium">Added Photos</div>
                <div className="space-y-1 text-muted-foreground">
                  {photos.map((photo) => (
                    <div key={photo.id}>{photo.fileName}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="text-base font-semibold">
          Comment {rule?.comment_required ? <span className="text-red-600">*</span> : null}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add notes"
          rows={5}
          className="w-full rounded-xl border px-3 py-3"
        />
      </section>

      <button
        type="button"
        disabled={saving || submitting}
        onClick={() => void onSubmit()}
        className="w-full rounded-2xl bg-blue-600 px-4 py-4 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Submitting…" : saving ? "Saving…" : "Submit Field Log"}
      </button>
    </div>
  );
}