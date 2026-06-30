// Replace the entire file:
// apps/web/src/features/field-log/pages/FieldLogDraftClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/shared/data/supabase/client";
import { useOrg } from "@/state/org";
import { useFieldLogRuntime } from "../hooks/useFieldLogRuntime";
import type { FieldLogRule } from "../lib/fieldLog.types";
import {
  buildFieldLogWorkflow,
  type FieldLogVerdict,
  useFieldLogEntrySource,
} from "../workflow";
import {
  getFieldLogOutcomeProfile,
  outcomeActionToVerdict,
} from "../workflow/fieldLogOutcomeProfiles";

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
  subjectFullName?: string | null;
  subjectTechId?: string | null;
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

const NEW_DROP_CATEGORY_KEY = "new_drop";
const CONDUIT_PULL_CATEGORY_KEY = "conduit_pull_install";
const SERVICE_FOLLOWUP_CATEGORY_KEY = "post_call";

const NEW_DROP_EVIDENCE_REQUIREMENTS = [
  {
    photo_label_key: "tap_photo",
    label: "Tap Photo",
    required: true,
    sort_order: 10,
    accept: "image/*",
    capture: true,
    helper: "Capture the tap photo.",
  },
  {
    photo_label_key: "ground_block_photo",
    label: "Ground Block Photo",
    required: true,
    sort_order: 20,
    accept: "image/*",
    capture: true,
    helper: "Capture the ground block photo.",
  },
  {
    photo_label_key: "bond_point_photo",
    label: "Bond Point Photo",
    required: true,
    sort_order: 30,
    accept: "image/*",
    capture: true,
    helper: "Capture the bond point photo.",
  },
  {
    photo_label_key: "workorder_snapshot",
    label: "Workorder Snapshot",
    required: true,
    sort_order: 40,
    accept: "image/*,application/pdf",
    capture: false,
    helper: "Upload the workorder snapshot from the mobile device.",
  },
] as const;

const CONDUIT_PULL_EVIDENCE_REQUIREMENTS = [
  {
    photo_label_key: "tap_photo",
    label: "Tap Photo",
    required: true,
    sort_order: 10,
    accept: "image/*",
    capture: true,
    helper: "Capture the tap photo.",
  },
  {
    photo_label_key: "ground_block_photo",
    label: "Ground Block Photo",
    required: true,
    sort_order: 20,
    accept: "image/*",
    capture: true,
    helper: "Capture the ground block photo.",
  },
  {
    photo_label_key: "bond_point_photo",
    label: "Bond Point Photo",
    required: true,
    sort_order: 30,
    accept: "image/*",
    capture: true,
    helper: "Capture the bond point photo.",
  },
  {
    photo_label_key: "conduit_line_entry_photo",
    label: "Conduit Line Entry Photo",
    required: true,
    sort_order: 40,
    accept: "image/*",
    capture: true,
    helper: "Capture the conduit line entry point.",
  },
  {
    photo_label_key: "conduit_line_exit_photo",
    label: "Conduit Line Exit Photo",
    required: true,
    sort_order: 50,
    accept: "image/*",
    capture: true,
    helper: "Capture the conduit line exit point.",
  },
] as const;

function isNewDropCategory(categoryKey: string) {
  return categoryKey === NEW_DROP_CATEGORY_KEY;
}

function isConduitPullCategory(categoryKey: string) {
  return categoryKey === CONDUIT_PULL_CATEGORY_KEY;
}

function isSpecialBillingCategory(categoryKey: string) {
  return isNewDropCategory(categoryKey) || isConduitPullCategory(categoryKey);
}

function getSpecialEvidenceRequirements(categoryKey: string) {
  if (isNewDropCategory(categoryKey)) return NEW_DROP_EVIDENCE_REQUIREMENTS;
  if (isConduitPullCategory(categoryKey)) return CONDUIT_PULL_EVIDENCE_REQUIREMENTS;
  return [];
}

function getFileExtension(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx);
}

function makeEvidenceFileName(params: {
  categoryKey: string;
  reportId: string;
  photoLabelKey: string | null;
  originalFileName: string;
}) {
  const { categoryKey, reportId, photoLabelKey, originalFileName } = params;
  const extension = getFileExtension(originalFileName);
  const evidenceKey = photoLabelKey ?? "unlabeled";
  return `${categoryKey}__${evidenceKey}__${reportId}__${Date.now()}${extension}`;
}

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


const SPECIAL_BILLING_CATEGORIES = new Set(["new_drop", "conduit_pull_install"]);

async function prepareSpecialBillingPacket(reportId: string, categoryKey: string) {
  const packetPath =
    categoryKey === "conduit_pull_install"
      ? "/api/field-log/conduit-pull/job-packet"
      : "/api/field-log/new-drop/job-packet";

  const packetRes = await fetch(`${packetPath}?report_id=${encodeURIComponent(reportId)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!packetRes.ok) {
    let message = "Field Log approved, but billing PDF generation failed.";
    try {
      const json = await packetRes.json();
      message = json?.error || message;
    } catch {}
    throw new Error(message);
  }

  const blob = await packetRes.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const disposition = packetRes.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  a.download = match?.[1] ?? `FieldLog_${reportId}.pdf`;

  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);

  const markPath =
    categoryKey === "conduit_pull_install"
      ? "/api/field-log/conduit-pull/mark-prepared"
      : "/api/field-log/new-drop/mark-prepared";

  const markRes = await fetch(markPath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reportId }),
  });

  const markJson = await markRes.json().catch(() => null);
  if (!markRes.ok || markJson?.ok === false) {
    throw new Error(markJson?.error || "Billing PDF downloaded, but prepared status was not recorded.");
  }
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
    subjectFullName,
    subjectTechId,
    completionHref = "/field-log",
  } = props;

  const { selectedOrgId } = useOrg();
  const { getRuleForSelection } = useFieldLogRuntime();
  const entrySource = useFieldLogEntrySource();
  const supabase = useMemo(() => createClient(), []);

  const rule = getRuleForSelection(categoryKey, subcategoryKey);
  const workflow = useMemo(
    () =>
      buildFieldLogWorkflow({
        entrySource,
        status: initialStatus,
      }),
    [entrySource, initialStatus],
  );
  const isFollowupMode =
    initialStatus === "tech_followup_required" && initialEditUnlocked === true;

  const [jobNumber, setJobNumber] = useState(initialJobNumber);
  const [jobType, setJobType] = useState<JobType>(
    initialJobType === "install" || initialJobType === "tc" || initialJobType === "sro"
      ? initialJobType
      : "",
  );
  const [comment, setComment] = useState(initialComment ?? "");
  const [technicianComments, setTechnicianComments] = useState("");
  const [customerContactFeedback, setCustomerContactFeedback] = useState("");
  const [lessonsTakeaways, setLessonsTakeaways] = useState("");
  const [useXm, setUseXm] = useState(
    workflow.requiresApprovalToClose &&
      (initialXmDeclared || initialEvidenceDeclared === "xm_platform"),
  );
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [existingPhotoCount] = useState(Math.max(0, initialPhotoCount ?? 0));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [isTechUploader, setIsTechUploader] = useState(false);
  const [location, setLocation] = useState<LocationState>({
    gpsLat: initialGpsLat ?? null,
    gpsLng: initialGpsLng ?? null,
    gpsAccuracyM: initialGpsAccuracyM ?? null,
    capturedAt: toCapturedAtMs(initialLocationCapturedAt),
    error: null,
  });

  const newDropMode = isNewDropCategory(categoryKey);
  const conduitPullMode = isConduitPullCategory(categoryKey);
  const specialBillingMode = isSpecialBillingCategory(categoryKey);
  const serviceFollowUpMode = categoryKey === SERVICE_FOLLOWUP_CATEGORY_KEY;
  const caseManagementMode = serviceFollowUpMode;
  const specialEvidenceRequirements = getSpecialEvidenceRequirements(categoryKey);

  const requiredPhotoCount = caseManagementMode
    ? 0
    : specialBillingMode
      ? specialEvidenceRequirements.length
      : rule?.min_photo_count ?? 0;
  const isTechSubmissionFlow = workflow.isTechSourced || isTechUploader;
  const requiresReviewBeforeClose =
    specialBillingMode || isTechSubmissionFlow || workflow.requiresApprovalToClose;
  const canFinalizeOnEntry =
    !isTechSubmissionFlow &&
    !workflow.requiresApprovalToClose &&
    !isFollowupMode &&
    workflow.canAssignFinalVerdict;
  const phaseLabel = isFollowupMode
    ? "Field Log Follow-Up"
    : newDropMode
      ? "New Drop Submission"
      : workflow.reviewLabel === "Unavailable"
        ? "Field Log Draft"
        : workflow.reviewLabel;
  const primaryActionLabel = isFollowupMode ? "Commit Update" : "Commit";
  const canUseXm =
    !specialBillingMode && (rule?.xm_allowed ?? false) && requiresReviewBeforeClose;
  const outcomeProfile = getFieldLogOutcomeProfile(categoryKey);
  const photoRequirements = caseManagementMode
    ? []
    : specialBillingMode
      ? specialEvidenceRequirements
      : rule?.photo_requirements ?? [];
  const locationRequired = !!rule?.location_required;
  const totalPhotoCount = existingPhotoCount + photos.length;
  const newDropLoadedKeys = useMemo(() => {
    return new Set(
      photos
        .map((photo) => photo.photoLabelKey)
        .filter((value): value is string => !!value),
    );
  }, [photos]);
  const newDropMissingEvidence = useMemo(() => {
    if (!specialBillingMode) return [];
    return specialEvidenceRequirements.filter(
      (item) => !newDropLoadedKeys.has(item.photo_label_key),
    );
  }, [newDropLoadedKeys, specialBillingMode, specialEvidenceRequirements]);
  const newDropEvidenceComplete =
    !specialBillingMode || newDropMissingEvidence.length === 0;

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
        setIsTechUploader(false);
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
          setIsTechUploader(false);
        }
      }
    }

    void loadSelfTechState();

    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  function getEffectiveComment() {
    if (!serviceFollowUpMode) return comment.trim();

    return [
      technicianComments.trim() ? `Technician Comments:\n${technicianComments.trim()}` : "",
      customerContactFeedback.trim()
        ? `Customer Contact Feedback:\n${customerContactFeedback.trim()}`
        : "",
      lessonsTakeaways.trim() ? `Lessons / Takeaways:\n${lessonsTakeaways.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  async function saveServiceFollowUpDetail() {
    if (!serviceFollowUpMode) return;

    const res = await fetch("/api/field-log/draft/post-call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportId,
        technicianComments: technicianComments.trim() || null,
        customerContactFeedback: customerContactFeedback.trim() || null,
        lessonsTakeaways: lessonsTakeaways.trim() || null,
        caseStatus: "open",
      }),
    });

    const json = (await res.json()) as ApiResponse;
    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Failed to save Service Follow Up detail.");
    }
  }

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
        comment: getEffectiveComment() || null,
        evidenceDeclared:
          !specialBillingMode && useXm ? "xm_platform" : totalPhotoCount > 0 ? "field_upload" : "none",
        xmDeclared: !specialBillingMode && useXm,
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
    const uploadFileName = specialBillingMode
      ? makeEvidenceFileName({
          categoryKey,
          reportId,
          photoLabelKey,
          originalFileName: file.name,
        })
      : file.name;

    const renamedFile =
      specialBillingMode && uploadFileName !== file.name
        ? new File([file], uploadFileName, {
            type: file.type || "application/octet-stream",
            lastModified: file.lastModified,
          })
        : file;

    const { dbFilePath } = await uploadFileToStorage(renamedFile);

    const res = await fetch("/api/field-log/attachment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportId,
        photoLabelKey,
        filePath: dbFilePath,
        fileName: uploadFileName,
        mimeType: renamedFile.type || "application/octet-stream",
        fileSizeBytes: renamedFile.size,
      }),
    });

    const json = (await res.json()) as ApiResponse;
    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Failed to add attachment.");
    }

    setPhotos((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${uploadFileName}`,
        fileName: uploadFileName,
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

  async function onSubmit(verdict?: FieldLogVerdict) {
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

    if (rule.comment_required && !getEffectiveComment()) {
      alert(serviceFollowUpMode ? "At least one Service Follow Up section is required." : "Comment is required.");
      return;
    }

    if (specialBillingMode && !newDropEvidenceComplete) {
      alert(
        `Missing required evidence:\n\n${newDropMissingEvidence
          .map((item) => `- ${item.label}`)
          .join("\n")}`,
      );
      return;
    }

    if (!caseManagementMode && !specialBillingMode && !useXm && totalPhotoCount < requiredPhotoCount) {
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

      await saveServiceFollowUpDetail();

      if (locationRequired && !hasCapturedLocation(activeLocation)) {
        throw new Error("Location capture is required before commit.");
      }

      if (canFinalizeOnEntry) {
        const finalizeRes = await fetch("/api/field-log/finalize-verdict", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reportId,
            verdict: verdict ?? "pass",
            note: getEffectiveComment() || null,
          }),
        });

        const finalizeJson = (await finalizeRes.json()) as ApiResponse;
        if (!finalizeRes.ok || !finalizeJson.ok) {
          throw new Error(finalizeJson.error || "Failed to finalize Field Log verdict.");
        }

        if (specialBillingMode && (verdict ?? "pass") === "pass") {
          try {
            await prepareSpecialBillingPacket(reportId, categoryKey);
          } catch (packetError) {
            alert(packetError instanceof Error ? packetError.message : "Approved, but billing packet failed.");
          }
        }

        window.location.href = completionHref;
        return;
      }

      const endpoint = isFollowupMode ? "/api/field-log/resubmit" : "/api/field-log/submit";

      const body = isFollowupMode
        ? {
            reportId,
            comment: getEffectiveComment() || null,
            gpsLat: activeLocation.gpsLat,
            gpsLng: activeLocation.gpsLng,
            gpsAccuracyM: activeLocation.gpsAccuracyM,
          }
        : {
            reportId,
            comment: getEffectiveComment() || null,
            evidenceDeclared:
              !specialBillingMode && useXm
                ? "xm_platform"
                : totalPhotoCount > 0
                  ? "field_upload"
                  : "none",
            xmDeclared: !specialBillingMode && useXm,
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
              : "Failed to commit Field Log report.")) + extra,
        );
      }

      window.location.href = completionHref;
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : isFollowupMode
            ? "Failed to resubmit."
            : "Failed to commit.",
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
          {phaseLabel}
        </div>
        <div className="mt-1 text-lg font-semibold">
          {rule?.category_label ?? categoryKey}
          {rule?.subcategory_label ? ` • ${rule.subcategory_label}` : ""}
        </div>
      </section>

      {(subjectFullName || subjectTechId) ? (
        <section className="rounded-2xl border bg-card p-4">
          <div className="text-sm font-semibold">Subject Technician</div>
          <div className="mt-2 text-lg font-semibold">
            {subjectFullName ?? "Unknown Technician"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Tech ID: <span className="font-medium text-foreground">{subjectTechId ?? "—"}</span>
          </div>
        </section>
      ) : null}

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
              {caseManagementMode
                ? "Optional evidence: upload from device or capture with camera."
                : specialBillingMode
                  ? "Required evidence items: "
                  : "Photos required: "}
              {!caseManagementMode ? (
                <span className="font-medium text-foreground">{requiredPhotoCount}</span>
              ) : null}
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
                    {"helper" in item && item.helper ? ` • ${item.helper}` : ""}
                  </div>
                  <input
                    type="file"
                    accept={"accept" in item ? item.accept : "image/*"}
                    {...(isTechUploader && (!("capture" in item) || item.capture)
                      ? { capture: "environment" as const }
                      : {})}
                    {...(specialBillingMode ? {} : { multiple: true })}
                    className="mt-3 block w-full text-sm"
                    onChange={(e) => void onPickFiles(e, item.photo_label_key)}
                  />
                </label>
              ))
            ) : caseManagementMode ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block rounded-xl border border-gray-200 px-3 py-3">
                  <div className="font-medium">Upload Evidence</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Choose images, PDFs, or supporting files from this device.
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="mt-3 block w-full text-sm"
                    onChange={(e) => void onPickFiles(e, null)}
                  />
                </label>

                <label className="block rounded-xl border border-gray-200 px-3 py-3">
                  <div className="font-medium">Capture Evidence</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Open the device camera and attach the image to this case.
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mt-3 block w-full text-sm"
                    onChange={(e) => void onPickFiles(e, null)}
                  />
                </label>
              </div>
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

            {specialBillingMode && newDropMissingEvidence.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <div className="mb-2 font-medium text-amber-900">Still Required</div>
                <div className="space-y-1 text-amber-800">
                  {newDropMissingEvidence.map((item) => (
                    <div key={item.photo_label_key}>{item.label}</div>
                  ))}
                </div>
              </div>
            ) : null}

            {photos.length > 0 ? (
              <div className="rounded-xl bg-muted/40 p-3 text-sm">
                <div className="mb-2 font-medium">
                  {specialBillingMode ? "Added Evidence" : "Added Photos"}
                </div>
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

      {serviceFollowUpMode ? (
        <section className="space-y-4 rounded-2xl border bg-card p-4">
          <div>
            <div className="text-base font-semibold">
              Service Follow Up Notes {rule?.comment_required ? <span className="text-red-600">*</span> : null}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Capture this as a case-management record, not a tech-facing QC verdict.
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Technician Comments</span>
            <textarea
              value={technicianComments}
              onChange={(e) => setTechnicianComments(e.target.value)}
              placeholder="What happened from the technician or job perspective?"
              rows={4}
              className="w-full rounded-xl border px-3 py-3"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Customer Contact Feedback</span>
            <textarea
              value={customerContactFeedback}
              onChange={(e) => setCustomerContactFeedback(e.target.value)}
              placeholder="What did the customer state during contact or follow-up?"
              rows={4}
              className="w-full rounded-xl border px-3 py-3"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Lessons / Takeaways</span>
            <textarea
              value={lessonsTakeaways}
              onChange={(e) => setLessonsTakeaways(e.target.value)}
              placeholder="What should be learned, coached, corrected, or watched?"
              rows={4}
              className="w-full rounded-xl border px-3 py-3"
            />
          </label>
        </section>
      ) : (
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
      )}

      {requiresReviewBeforeClose || isFollowupMode ? (
        <button
          type="button"
          disabled={
            saving ||
            submitting ||
            (locationRequired && capturingLocation) ||
            (specialBillingMode && !newDropEvidenceComplete)
          }
          onClick={() => void onSubmit()}
          className="w-full rounded-2xl bg-blue-600 px-4 py-4 font-semibold text-white disabled:opacity-60"
        >
          {submitting
            ? isFollowupMode
              ? "Committing…"
              : "Committing…"
            : saving
              ? "Saving…"
              : isFollowupMode
                ? "Commit Update"
                : primaryActionLabel}
        </button>
      ) : (
        <section className="rounded-2xl border bg-card p-4">
          <div className="text-base font-semibold">Finalize Entry</div>
          <div className="mt-1 text-sm text-muted-foreground">
            This entry will be finalized now and retained for audit review.
          </div>

          <div className="mt-4 grid gap-2">
            {outcomeProfile.primaryActions.map((action) => (
              <button
                key={action.action}
                type="button"
                disabled={saving || submitting || (locationRequired && capturingLocation)}
                onClick={() => void onSubmit(outcomeActionToVerdict(action.action))}
                className={`rounded-xl px-4 py-3 font-semibold disabled:opacity-60 ${
                  action.tone === "success"
                    ? "bg-green-600 text-white"
                    : action.tone === "danger"
                      ? "border border-red-300 text-red-700"
                      : "border"
                }`}
              >
                {submitting ? "Finalizing…" : action.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}