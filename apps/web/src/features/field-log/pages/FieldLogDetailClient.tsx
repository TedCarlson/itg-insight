"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/state/session";
import { useOrg } from "@/state/org";
import { useAccessPass } from "@/state/access";
import { createClient } from "@/shared/data/supabase/client";
import { FieldLogTimelineCard } from "../components/FieldLogTimelineCard";
import { useFieldLogPolling } from "../hooks/useFieldLogPolling";
import { getStatusChip, niceStatus } from "../lib/statusStyles";
import { FieldLogReviewActionsCard } from "../components/FieldLogReviewActionsCard";
import { FieldLogReassignFollowupCard } from "../components/FieldLogReassignFollowupCard";
import { FieldLogTechReviewActionsCard } from "../components/FieldLogTechReviewActionsCard";
import { FieldLogVerdictActionsCard } from "../components/FieldLogVerdictActionsCard";
import { FieldLogAttachmentsCard } from "../components/FieldLogAttachmentsCard";
import { FieldLogTechFollowupCard } from "../components/FieldLogTechFollowupCard";
import { FieldLogDetailHeaderCard } from "../components/FieldLogDetailHeaderCard";
import { FieldLogCommentCard } from "../components/FieldLogCommentCard";
import { FieldLogSubmissionCard } from "../components/FieldLogSubmissionCard";
import { FieldLogWorkflowCard } from "../components/FieldLogWorkflowCard";
import { FieldLogNotDoneDetailCard } from "../components/FieldLogNotDoneDetailCard";
import { FieldLogPostCallDetailCard } from "../components/FieldLogPostCallDetailCard";
import { FieldLogServiceFollowUpCaseActionsCard } from "../components/FieldLogServiceFollowUpCaseActionsCard";
import { ALLOW_SUPERVISOR_PROXY_UPLOAD } from "../lib/rolloutFlags";
import type { FieldLogVerdict } from "../workflow";
import { buildFieldLogWorkflow, useFieldLogEntrySource } from "../workflow";
import type {
  FieldLogApiResponse,
  FieldLogDetailPayload,
  FieldLogTimelineEvent,
} from "../lib/fieldLogDetail.types";

function makeStoragePath(reportId: string, fileName: string) {
  const safeName = fileName.replace(/\s+/g, "-");
  return `${reportId}/${Date.now()}-${safeName}`;
}

function makeDbFilePath(objectPath: string) {
  return `field-log/${objectPath}`;
}

function canViewTimeline(accessPass: any) {
  if (!accessPass) return false;
  if (accessPass.is_admin || accessPass.is_app_owner || accessPass.is_owner) return true;

  const perms = Array.isArray(accessPass.permissions) ? accessPass.permissions : [];
  return (
    perms.includes("leadership_manage") ||
    perms.includes("permissions_manage") ||
    perms.includes("metrics_manage")
  );
}


const SERVICE_FOLLOWUP_CATEGORY_KEY = "post_call";
const SPECIAL_BILLING_CATEGORIES = new Set(["new_drop", "conduit_pull_install"]);

async function prepareSpecialBillingPacket(reportId: string, categoryKey: string) {
  const packetPath =
    categoryKey === "conduit_pull_install"
      ? "/api/field-log/conduit-pull/job-packet"
      : "/api/field-log/new-drop/job-packet";

  const packetRes = await fetch(
    `${packetPath}?report_id=${encodeURIComponent(reportId)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

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

  const emailRes = await fetch("/api/field-log/billing-email/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reportId,
      categoryKey,
      sendMode: "auto",
    }),
  });

  const emailJson = await emailRes.json().catch(() => null);
  if (!emailRes.ok || emailJson?.ok === false) {
    alert(emailJson?.error || "Billing packet prepared, but email send failed.");
  }
}

export function FieldLogDetailClient(props: { initialData: FieldLogDetailPayload }) {
  const { initialData } = props;
  const searchParams = useSearchParams();
  const fromReview = searchParams.get("from") === "review";

  const { userId } = useSession();
  const { selectedOrgId } = useOrg();
  const { accessPass } = useAccessPass();
  const entrySource = useFieldLogEntrySource();
  const supabase = useMemo(() => createClient(), []);

  const [data, setData] = useState<FieldLogDetailPayload>(initialData);
  const [busy, setBusy] = useState(false);
  const [proxyUploading, setProxyUploading] = useState(false);
  const [xmLink, setXmLink] = useState("");
  const [timeline, setTimeline] = useState<FieldLogTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [followupNote, setFollowupNote] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [caseTechnicianComments, setCaseTechnicianComments] = useState(
    initialData.post_call?.technician_comments ?? "",
  );
  const [caseCustomerContactFeedback, setCaseCustomerContactFeedback] = useState(
    initialData.post_call?.customer_contact_feedback ?? "",
  );
  const [caseLessonsTakeaways, setCaseLessonsTakeaways] = useState(
    initialData.post_call?.lessons_takeaways ?? "",
  );

  const showTimeline = useMemo(() => canViewTimeline(accessPass), [accessPass]);

  const isServiceFollowUp = data.category_key === SERVICE_FOLLOWUP_CATEGORY_KEY;
  const serviceCaseStatus = data.post_call?.case_status ?? "open";
  const serviceCaseClosed = serviceCaseStatus === "closed";

  useEffect(() => {
    setCaseTechnicianComments(data.post_call?.technician_comments ?? "");
    setCaseCustomerContactFeedback(data.post_call?.customer_contact_feedback ?? "");
    setCaseLessonsTakeaways(data.post_call?.lessons_takeaways ?? "");
  }, [
    data.report_id,
    data.post_call?.technician_comments,
    data.post_call?.customer_contact_feedback,
    data.post_call?.lessons_takeaways,
  ]);


  const workflow = useMemo(
    () =>
      buildFieldLogWorkflow({
        entrySource,
        status: data.status,
        recordEntrySource: data.entry_source_role,
        recordWorkflowMode: data.workflow_mode,
        recordRequiresApprovalToClose: data.requires_approval_to_close,
        recordCanCloseOnEntry: data.can_close_on_entry,
      }),
    [
      entrySource,
      data.status,
      data.entry_source_role,
      data.workflow_mode,
      data.requires_approval_to_close,
      data.can_close_on_entry,
    ],
  );

  const hasRecordWorkflowTruth =
    data.entry_source_role != null ||
    data.workflow_mode != null ||
    data.requires_approval_to_close != null ||
    data.can_close_on_entry != null;

  const isPendingReviewerAction =
    data.status === "pending_review" || data.status === "sup_followup_required";

  const isSelfSubmittedReport =
    !!userId && String(data.created_by_user_id ?? "") === String(userId);

  const canActAsFieldLogReviewer =
    entrySource !== "TECH" && entrySource !== "UNKNOWN" && !isSelfSubmittedReport;

  const showsTechReviewActions =
    canActAsFieldLogReviewer &&
    (hasRecordWorkflowTruth
      ? workflow.requiresApprovalToClose
      : isPendingReviewerAction);

  const canApprove = useMemo(() => {
    return showsTechReviewActions && isPendingReviewerAction;
  }, [isPendingReviewerAction, showsTechReviewActions]);

  const isTechFollowup = data.status === "tech_followup_required";
  const canResubmit = isTechFollowup && data.edit_unlocked && data.created_by_user_id === userId;

  const shouldPollDetail =
    data.status === "pending_review" ||
    data.status === "tech_followup_required" ||
    data.status === "sup_followup_required" ||
    (isServiceFollowUp && !serviceCaseClosed);

  const canUseSupervisorProxyUpload =
    ALLOW_SUPERVISOR_PROXY_UPLOAD && fromReview && canApprove;

  const refreshDetail = useCallback(async () => {
    const res = await fetch(
      `/api/field-log/detail?reportId=${encodeURIComponent(data.report_id)}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    const json = (await res.json()) as FieldLogApiResponse<FieldLogDetailPayload>;
    if (!res.ok || !json.ok || !json.data) {
      throw new Error(json.error || "Failed to refresh Field Log detail.");
    }

    setData(json.data);
  }, [data.report_id]);

  const loadTimeline = useCallback(async () => {
    if (!showTimeline) {
      setTimeline([]);
      setTimelineLoading(false);
      setTimelineError(null);
      return;
    }

    setTimelineError(null);

    try {
      const res = await fetch(
        `/api/field-log/timeline?reportId=${encodeURIComponent(data.report_id)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const json = (await res.json()) as FieldLogApiResponse<FieldLogTimelineEvent[]>;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load Field Log timeline.");
      }

      setTimeline(json.data ?? []);
    } catch (err) {
      setTimelineError(err instanceof Error ? err.message : "Failed to load timeline.");
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [data.report_id, showTimeline]);

  useEffect(() => {
    setTimelineLoading(showTimeline);
    void loadTimeline();
  }, [loadTimeline, showTimeline]);

  useFieldLogPolling({
    enabled: shouldPollDetail,
    intervalMs: 15000,
    onTick: async () => {
      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
    },
  });

  async function approve() {
    if (!userId) {
      alert("No signed-in user found.");
      return;
    }

    if (!selectedOrgId) {
      alert("Select a PC scope first.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/field-log/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId: data.report_id,
          actionByUserId: userId,
          xmLink: xmLink.trim() || null,
          note: followupNote.trim() || null,
        }),
      });

      const json = (await res.json()) as FieldLogApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to approve Field Log.");
      }

      if (fromReview) {
        window.location.href = "/field-log/review";
        return;
      }

      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
      setXmLink("");
      setFollowupNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeVerdict(verdict: FieldLogVerdict) {
    if (!userId) {
      alert("No signed-in user found.");
      return;
    }

    const note = followupNote.trim();

    if (verdict === "fail_tech_followup" && !note) {
      alert("Tech follow-up verdict requires a note.");
      return;
    }

    if (verdict === "closed_by_leadership" && !note) {
      alert("Leadership closure requires a note.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/field-log/finalize-verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId: data.report_id,
          verdict,
          note: note || null,
          xmLink: xmLink.trim() || data.xm_link || null,
        }),
      });

      const json = (await res.json()) as FieldLogApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to finalize verdict.");
      }

      if (SPECIAL_BILLING_CATEGORIES.has(data.category_key) && verdict === "pass") {
        try {
          await prepareSpecialBillingPacket(data.report_id, data.category_key);
        } catch (packetError) {
          alert(packetError instanceof Error ? packetError.message : "Approved, but billing packet failed.");
        }
      }

      if (fromReview) {
        window.location.href = "/field-log/review";
        return;
      }

      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
      setXmLink("");
      setFollowupNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to finalize verdict.");
    } finally {
      setBusy(false);
    }
  }

  async function denySubmission() {
    if (!userId) {
      alert("No signed-in user found.");
      return;
    }

    const note = followupNote.trim();

    if (!note) {
      alert("Rejection requires a verdict note.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/field-log/deny", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId: data.report_id,
          note,
        }),
      });

      const json = (await res.json()) as FieldLogApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to reject Field Log.");
      }

      if (fromReview) {
        window.location.href = "/field-log/review";
        return;
      }

      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
      setFollowupNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject.");
    } finally {
      setBusy(false);
    }
  }

  async function reassignFollowup(followupOwnerPersonId: string) {
    setBusy(true);

    try {
      const res = await fetch("/api/field-log/reassign-followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId: data.report_id,
          followupOwnerPersonId,
          note: reassignNote,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to reassign follow-up.");
      }

      setReassignNote("");
      await refreshDetail();

      if (showTimeline) {
        await loadTimeline();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reassign follow-up.");
    } finally {
      setBusy(false);
    }
  }

  async function requestFollowup(followupType: "tech" | "supervisor") {
    if (!userId) {
      alert("No signed-in user found.");
      return;
    }

    const note = followupNote.trim();

    if (!note) {
      alert("Please add a short follow-up note before sending this back.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/field-log/followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId: data.report_id,
          actionByUserId: userId,
          followupType,
          note,
        }),
      });

      const json = (await res.json()) as FieldLogApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to request follow-up.");
      }

      if (fromReview) {
        window.location.href = "/field-log/review";
        return;
      }

      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
      setFollowupNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to request follow-up.");
    } finally {
      setBusy(false);
    }
  }

  async function resubmit() {
    setBusy(true);
    try {
      const res = await fetch("/api/field-log/resubmit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId: data.report_id,
          comment: data.comment ?? null,
          gpsLat: data.gps_lat ?? null,
          gpsLng: data.gps_lng ?? null,
          gpsAccuracyM: data.gps_accuracy_m ?? null,
        }),
      });

      const json = (await res.json()) as FieldLogApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to resubmit Field Log.");
      }

      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resubmit.");
    } finally {
      setBusy(false);
    }
  }

  async function onSupervisorPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setProxyUploading(true);
    try {
      for (const file of files) {
        const objectPath = makeStoragePath(data.report_id, file.name);

        const { error: uploadError } = await supabase.storage
          .from("field-log")
          .upload(objectPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });

        if (uploadError) {
          throw new Error(uploadError.message || "Failed to upload file.");
        }

        const res = await fetch("/api/field-log/attachment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reportId: data.report_id,
            photoLabelKey: null,
            filePath: makeDbFilePath(objectPath),
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSizeBytes: file.size,
          }),
        });

        const json = (await res.json()) as FieldLogApiResponse;
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to add supervisor attachment.");
        }
      }

      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload photo for technician.");
    } finally {
      setProxyUploading(false);
      e.target.value = "";
    }
  }

  async function updateServiceFollowUpCase(nextStatus?: "open" | "in_progress" | "pending_customer" | "resolved" | "closed" | "reopened") {
    if (!isServiceFollowUp) return;

    setBusy(true);
    try {
      const res = await fetch("/api/field-log/draft/post-call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId: data.report_id,
          technicianComments: caseTechnicianComments.trim() || null,
          customerContactFeedback: caseCustomerContactFeedback.trim() || null,
          lessonsTakeaways: caseLessonsTakeaways.trim() || null,
          caseStatus: nextStatus ?? serviceCaseStatus ?? "open",
        }),
      });

      const json = (await res.json()) as FieldLogApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to commit Service Follow Up case.");
      }

      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to commit Service Follow Up case.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateBillingPdf() {
    if (!SPECIAL_BILLING_CATEGORIES.has(data.category_key)) return;

    setBusy(true);
    try {
      await prepareSpecialBillingPacket(data.report_id, data.category_key);
      await refreshDetail();
      if (showTimeline) {
        await loadTimeline();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download billing PDF.");
    } finally {
      setBusy(false);
    }
  }

  const canRegenerateBillingPdf =
    data.status === "approved" && SPECIAL_BILLING_CATEGORIES.has(data.category_key);

  const chip = getStatusChip(data.status);

  return (
    <div className="space-y-4">
      <FieldLogDetailHeaderCard
        jobNumber={data.job_number}
        categoryLabel={data.category_label}
        categoryKey={data.category_key}
        subcategoryLabel={data.subcategory_label}
        jobType={data.job_type}
        chipLabel={chip.label}
        chipClassName={chip.className}
        statusTitle={niceStatus(data.status)}
        backHref={fromReview ? "/field-log/review" : "/field-log"}
        minPhotoCount={data.rule?.min_photo_count}
        xmAllowed={data.rule?.xm_allowed}
        commentRequired={data.rule?.comment_required}
        locationRequired={data.rule?.location_required}
        toleranceMeters={data.rule?.location_tolerance_m}
        photoRequirements={data.rule?.photo_requirements}
        caseStatusLabel={isServiceFollowUp ? serviceCaseStatus.replaceAll("_", " ").toUpperCase() : null}
        caseStatusClassName={
          isServiceFollowUp
            ? serviceCaseClosed
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
            : null
        }
      />

      {canRegenerateBillingPdf ? (
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Billing PDF</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Download or regenerate the approved billing packet for this record.
              </div>
            </div>

            <button
              type="button"
              onClick={() => void regenerateBillingPdf()}
              disabled={busy}
              className="rounded-xl border px-3 py-2 text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Preparing…" : "Download Billing PDF"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <FieldLogWorkflowCard
            workflow={workflow}
            recordEntrySourceRole={data.entry_source_role}
            recordWorkflowMode={data.workflow_mode}
            requiresApprovalToClose={data.requires_approval_to_close}
            canCloseOnEntry={data.can_close_on_entry}
          />

          <FieldLogSubmissionCard
            createdAt={data.created_at}
            submittedAt={data.submitted_at}
            approvedAt={data.approved_at}
            photoCount={data.photo_count}
            evidenceDeclared={data.evidence_declared}
            xmDeclared={data.xm_declared}
            xmLinkValid={data.xm_link_valid}
            xmLink={data.xm_link}
            pcOrgId={data.pc_org_id}
            gpsLat={data.gps_lat}
            gpsLng={data.gps_lng}
            gpsAccuracyM={data.gps_accuracy_m}
            locationCapturedAt={data.location_captured_at}
          />

          <FieldLogCommentCard
            comment={data.comment}
            followupNote={data.followup_note}
          />

          <FieldLogNotDoneDetailCard
            visible={
              data.category_key === "not_done" || data.category_key === "u_code_applied"
            }
            selectedUcode={data.not_done?.selected_ucode ?? null}
            customerContactAttempted={data.not_done?.customer_contact_attempted ?? null}
            accessIssue={data.not_done?.access_issue ?? null}
            safetyIssue={data.not_done?.safety_issue ?? null}
            escalationRequired={data.not_done?.escalation_required ?? null}
            escalationType={data.not_done?.escalation_type ?? null}
          />

          <FieldLogPostCallDetailCard
            visible={data.category_key === "post_call"}
            riskLevel={data.post_call?.risk_level ?? null}
            tnpsRiskFlag={data.post_call?.tnps_risk_flag ?? null}
            followupRecommended={data.post_call?.followup_recommended ?? null}
            technicianComments={data.post_call?.technician_comments ?? null}
            customerContactFeedback={data.post_call?.customer_contact_feedback ?? null}
            lessonsTakeaways={data.post_call?.lessons_takeaways ?? null}
            caseStatus={data.post_call?.case_status ?? null}
          />
        </div>

        <div className="space-y-4">
          <FieldLogAttachmentsCard attachments={data.attachments ?? []} />

          <FieldLogReviewActionsCard actions={data.actions ?? []} />

          <FieldLogServiceFollowUpCaseActionsCard
            visible={isServiceFollowUp && canActAsFieldLogReviewer}
            busy={busy}
            caseStatus={serviceCaseStatus}
            technicianComments={caseTechnicianComments}
            customerContactFeedback={caseCustomerContactFeedback}
            lessonsTakeaways={caseLessonsTakeaways}
            onTechnicianCommentsChange={setCaseTechnicianComments}
            onCustomerContactFeedbackChange={setCaseCustomerContactFeedback}
            onLessonsTakeawaysChange={setCaseLessonsTakeaways}
            onCommitUpdate={() => updateServiceFollowUpCase()}
            onChangeStatus={(status) => updateServiceFollowUpCase(status)}
          />

          {showTimeline ? (
            <>
              <FieldLogReassignFollowupCard
                busy={busy}
                status={data.status}
                currentOwnerPersonId={data.followup_owner_person_id ?? null}
                note={reassignNote}
                onNoteChange={setReassignNote}
                onReassign={reassignFollowup}
              />

              <FieldLogTimelineCard
                timeline={timeline}
                loading={timelineLoading}
                error={timelineError}
              />
            </>
          ) : null}

          {!workflow.isTechSourced ? null : null}

          {!showsTechReviewActions && !isServiceFollowUp ? (
            <FieldLogVerdictActionsCard
              busy={busy}
              workflow={workflow}
              categoryKey={data.category_key}
              note={followupNote}
              xmAllowed={!!data.rule?.xm_allowed}
              xmDeclared={!!data.xm_declared}
              evidenceDeclared={data.evidence_declared}
              existingXmLink={data.xm_link}
              xmLinkValid={!!data.xm_link_valid}
              xmLink={xmLink}
              onXmLinkChange={setXmLink}
              onNoteChange={setFollowupNote}
              onFinalizeVerdict={finalizeVerdict}
              onDeny={denySubmission}
            />
          ) : null}

          {showsTechReviewActions && !isServiceFollowUp ? (
            <FieldLogTechReviewActionsCard
              busy={busy}
              canApprove={canApprove}
            xmAllowed={!!data.rule?.xm_allowed}
            xmDeclared={!!data.xm_declared}
            xmLinkValid={!!data.xm_link_valid}
            xmLink={xmLink}
            followupNote={followupNote}
            photoCount={Number(data.photo_count ?? 0)}
            minPhotoCount={Number(data.rule?.min_photo_count ?? 0)}
            onXmLinkChange={setXmLink}
            onFollowupNoteChange={setFollowupNote}
            onApprove={approve}
              onRequestTechFollowup={() => requestFollowup("tech")}
              onRequestSupervisorFollowup={() => requestFollowup("supervisor")}
              onCloseReport={() => finalizeVerdict("closed_by_leadership")}
            />
          ) : null}

          {canUseSupervisorProxyUpload ? (
            <section className="rounded-2xl border bg-card p-5">
              <div className="text-base font-semibold">Supervisor Upload (Adoption Mode)</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Upload technician photos on their behalf while onboarding and access rollout are in progress.
              </div>

              <label className="mt-4 block rounded-xl border border-dashed px-4 py-4 text-sm">
                <div className="font-medium">Upload Photo for Technician</div>
                <div className="mt-1 text-muted-foreground">
                  Select one or more images from this device.
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="mt-3 block w-full text-sm"
                  disabled={proxyUploading || busy}
                  onChange={(e) => void onSupervisorPickFiles(e)}
                />
              </label>

              <div className="mt-3 text-xs text-muted-foreground">
                Temporary rollout support. Intended for supervisor-assisted submissions only.
              </div>
            </section>
          ) : null}

          <FieldLogTechFollowupCard
            busy={busy}
            canResubmit={canResubmit}
            onResubmit={resubmit}
          />
        </div>
      </section>
    </div>
  );
}