// Replace the entire file:
// apps/web/src/features/field-log/pages/FieldLogDraftClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/shared/data/supabase/client";
import { useOrg } from "@/state/org";
import { useFieldLogRuntime } from "../hooks/useFieldLogRuntime";
import type { FieldLogRule } from "../lib/fieldLog.types";

type FieldLogDraftClientProps = {
  reportId: string;
  categoryKey: string;
  subcategoryKey: string | null;
  initialJobNumber: string;
  initialJobType: string | null;
  initialStatus: string;
  initialEditUnlocked: boolean;
  initialComment: string;
  initialEvidenceDeclared: "field_upload" | "xm_platform" | "none" | string | null;
  initialXmDeclared: boolean;
  initialPhotoCount: number;
  initialGpsLat: number | null;
  initialGpsLng: number | null;
  initialGpsAccuracyM: number | null;
  initialLocationCapturedAt: string | null;
  completionHref?: string;
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

type LocationState = {
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracyM: number | null;
  capturedAt: number | null;
  error: string | null;
};

type SelfTechResponse = {
  ok: boolean;
  isTechUploader?: boolean;
  personId?: string | null;
  techId?: string | null;
  error?: string;
};

function makeStoragePath(reportId: string, fileName: string) {
  const safeName = fileName.replace(/\s+/g, "-");
  return `${reportId}/${Date.now()}-${safeName}`;
}

function makeDbFilePath(objectPath: string) {
  return `field-log/${objectPath}`;
}

function needsSubcategory(rule: FieldLogRule | null, subcategoryKey: string | null) {
  if (!rule) return false;
  if (!rule.require_subcategory) return false;
  return !subcategoryKey;
}

function hasCapturedLocation(location: LocationState) {
  return location.gpsLat != null && location.gpsLng != null;
}

function formatLocationStatus(location: LocationState, capturingLocation: boolean) {
  if (capturingLocation) return "Capturing location…";
  if (hasCapturedLocation(location)) return "Location captured";
  if (location.error) return location.error;
  return "Location not captured";
}

function formatCapturedAt(value: number | null) {
  if (!value) return null;
  const d = new Date(value);
  return d.toLocaleTimeString();
}

function toCapturedAtMs(value: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export default function FieldLogDraftClient(props: FieldLogDraftClientProps) {
  const {
    reportId,
    categoryKey,
    subcategoryKey,
    initialJobNumber,
    initialJobType,
    initialStatus,
    initialEditUnlocked,
    initialComment,
    initialEvidenceDeclared,
    initialXmDeclared,
    initialPhotoCount,
    initialGpsLat,
    initialGpsLng,
    initialGpsAccuracyM,
    initialLocationCapturedAt,
    completionHref = "/field-log",
  } = props;

  const { selectedOrgId } = useOrg();
  const { getRuleForSelection } = useFieldLogRuntime();
  const supabase = useMemo(() => createClient(), []);

  const rule = getRuleForSelection(categoryKey, subcategoryKey);
  const isFollowupMode =
    initialStatus === "tech_followup_required" && initialEditUnlocked === true;

  const [jobNumber, setJobNumber] = useState(initialJobNumber);
  const [jobType, setJobType] = useState<JobType>(
    initialJobType === "install" || initialJobType === "tc" || initialJobType === "sro"
      ? initialJobType
      : "",
  );
  const [comment, setComment] = useState(initialComment ?? "");
  const [useXm, setUseXm] = useState(
    initialXmDeclared || initialEvidenceDeclared === "xm_platform",
  );
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [existingPhotoCount] = useState(Math.max(0, initialPhotoCount ?? 0));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [isTechUploader, setIsTechUploader] = useState(true);
  const [location, setLocation] = useState<LocationState>({
    gpsLat: initialGpsLat ?? null,
    gpsLng: initialGpsLng ?? null,
    gpsAccuracyM: initialGpsAccuracyM ?? null,
    capturedAt: toCapturedAtMs(initialLocationCapturedAt),
    error: null,
  });

  const requiredPhotoCount = rule?.min_photo_count ?? 0;
  const canUseXm = rule?.xm_allowed ?? false;
  const photoRequirements = rule?.photo_requirements ?? [];
  const locationRequired = !!rule?.location_required;
  const totalPhotoCount = existingPhotoCount + photos.length;

  const photoCountText = useMemo(() => {
    return `${totalPhotoCount}/${requiredPhotoCount}`;
  }, [totalPhotoCount, requiredPhotoCount]);

  const locationStatusText = useMemo(() => {
    return formatLocationStatus(location, capturingLocation);
  }, [location, capturingLocation]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelfTechState() {
      if (!selectedOrgId) {
        setIsTechUploader(true);
        return;
      }

      try {
        const res = await fetch(
          `/api/field-log/self-tech?pc_org_id=${encodeURIComponent(selectedOrgId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const json = (await res.json()) as SelfTechResponse;
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to resolve uploader mode.");
        }

        if (!cancelled) {
          setIsTechUploader(!!json.isTechUploader);
        }
      } catch {
        if (!cancelled) {
          setIsTechUploader(true);
        }
      }
    }

    void loadSelfTechState();

    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  async function saveBaseFields(locationOverride?: Partial<LocationState>) {
    const gpsLat = locationOverride?.gpsLat ?? location.gpsLat;
    const gpsLng = locationOverride?.gpsLng ?? location.gpsLng;
    const gpsAccuracyM = locationOverride?.gpsAccuracyM ?? location.gpsAccuracyM;

    const res = await fetch("/api/field-log/draft/base", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportId,
        jobNumber: jobNumber.trim(),
        jobType: jobType || null,
        comment: comment.trim() || null,
        evidenceDeclared: useXm ? "xm_platform" : totalPhotoCount > 0 ? "field_upload" : "none",
        xmDeclared: useXm,
        gpsLat,
        gpsLng,
        gpsAccuracyM,
      }),
    });

    const json = (await res.json()) as ApiResponse;
    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Failed to save record.");
    }
  }

  async function captureLocation(options?: { persist?: boolean; force?: boolean }) {
    const persist = options?.persist ?? true;
    const force = options?.force ?? false;

    if (!force && hasCapturedLocation(location)) {
      return location;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      const next = {
        gpsLat: null,
        gpsLng: null,
        gpsAccuracyM: null,
        capturedAt: null,
        error: "Location services unavailable on this device.",
      };
      setLocation(next);
      return next;
    }

    setCapturingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const next: LocationState = {
        gpsLat: position.coords.latitude,
        gpsLng: position.coords.longitude,
        gpsAccuracyM: position.coords.accuracy,
        capturedAt: Date.now(),
        error: null,
      };

      setLocation(next);

      if (persist) {
        await saveBaseFields(next);
      }

      return next;
    } catch (err: any) {
      let message = "Location capture failed.";

      if (err?.code === 1) message = "Location permission denied.";
      else if (err?.code === 2) message = "Location unavailable.";
      else if (err?.code === 3) message = "Location request timed out.";

      const next: LocationState = {
        gpsLat: null,
        gpsLng: null,
        gpsAccuracyM: null,
        capturedAt: null,
        error: message,
      };

      setLocation(next);
      return next;
    } finally {
      setCapturingLocation(false);
    }
  }

  async function uploadFileToStorage(file: File) {
    const objectPath = makeStoragePath(reportId, file.name);

    const { error } = await supabase.storage.from("field-log").upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (error) {
      throw new Error(error.message || "Failed to upload file.");
    }

    return {
      objectPath,
      dbFilePath: makeDbFilePath(objectPath),
    };
  }

  async function addAttachment(file: File, photoLabelKey: string | null) {
    const { dbFilePath } = await uploadFileToStorage(file);

    const res = await fetch("/api/field-log/attachment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportId,
        photoLabelKey,
        filePath: dbFilePath,
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
        filePath: dbFilePath,
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

      if (locationRequired && !hasCapturedLocation(location)) {
        await captureLocation({ persist: true });
      } else {
        await saveBaseFields();
      }

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
      alert("No active rule found for this record.");
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

    if (!useXm && totalPhotoCount < requiredPhotoCount) {
      alert(`At least ${requiredPhotoCount} photo(s) required.`);
      return;
    }

    setSubmitting(true);
    try {
      let activeLocation = location;

      if (locationRequired && !hasCapturedLocation(activeLocation)) {
        activeLocation = await captureLocation({ persist: true, force: true });
      } else {
        await saveBaseFields();
      }

      if (locationRequired && !hasCapturedLocation(activeLocation)) {
        throw new Error("Location capture is required before submit.");
      }

      const endpoint = isFollowupMode ? "/api/field-log/resubmit" : "/api/field-log/submit";

      const body = isFollowupMode
        ? {
            reportId,
            comment: comment.trim() || null,
            gpsLat: activeLocation.gpsLat,
            gpsLng: activeLocation.gpsLng,
            gpsAccuracyM: activeLocation.gpsAccuracyM,
          }
        : {
            reportId,
            comment: comment.trim() || null,
            evidenceDeclared: useXm ? "xm_platform" : totalPhotoCount > 0 ? "field_upload" : "none",
            xmDeclared: useXm,
            gpsLat: activeLocation.gpsLat,
            gpsLng: activeLocation.gpsLng,
            gpsAccuracyM: activeLocation.gpsAccuracyM,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        const extra =
          json.errors && json.errors.length > 0 ? `\n\n${json.errors.join("\n")}` : "";
        throw new Error(
          (json.error ||
            (isFollowupMode
              ? "Failed to resubmit follow-up."
              : "Failed to submit Field Log report.")) + extra,
        );
      }

      window.location.href = completionHref;
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : isFollowupMode
            ? "Failed to resubmit."
            : "Failed to submit.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!locationRequired || hasCapturedLocation(location)) return;
    void captureLocation({ persist: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, locationRequired]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-sm text-muted-foreground">
          {isFollowupMode ? "Field Log Follow-Up" : "Field Log Draft"}
        </div>
        <div className="mt-1 text-lg font-semibold">
          {rule?.category_label ?? categoryKey}
          {rule?.subcategory_label ? ` • ${rule.subcategory_label}` : ""}
        </div>
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Location</div>
            <div className="text-sm text-muted-foreground">
              {locationRequired ? "Required for this submission." : "Optional for this submission."}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void captureLocation({ persist: true, force: true })}
            disabled={capturingLocation || saving || submitting}
            className="rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {capturingLocation ? "Capturing…" : "Refresh Location"}
          </button>
        </div>

        <div className="rounded-xl bg-muted/40 p-3 text-sm">
          <div className="font-medium">{locationStatusText}</div>
          {location.capturedAt ? (
            <div className="mt-1 text-muted-foreground">
              Captured at {formatCapturedAt(location.capturedAt)}
            </div>
          ) : null}
          {location.error ? <div className="mt-1 text-red-600">{location.error}</div> : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Evidence</div>
            <div className="text-sm text-muted-foreground">
              Photos required:{" "}
              <span className="font-medium text-foreground">{requiredPhotoCount}</span>
            </div>
          </div>
          <div className="text-sm font-medium">{photoCountText}</div>
        </div>

        {existingPhotoCount > 0 ? (
          <div className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
            Existing Photos: {existingPhotoCount}
          </div>
        ) : null}

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
                    {...(isTechUploader ? { capture: "environment" as const } : {})}
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
                  {...(isTechUploader ? { capture: "environment" as const } : {})}
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
        disabled={saving || submitting || (locationRequired && capturingLocation)}
        onClick={() => void onSubmit()}
        className="w-full rounded-2xl bg-blue-600 px-4 py-4 font-semibold text-white disabled:opacity-60"
      >
        {submitting
          ? isFollowupMode
            ? "Resubmitting…"
            : "Submitting…"
          : saving
            ? "Saving…"
            : isFollowupMode
              ? "Resubmit Follow-Up"
              : "Submit Field Log"}
      </button>
    </div>
  );
}