export function niceStatus(status: string) {
  return status.replaceAll("_", " ");
}

function isResubmittedForReview(lastActionType?: string | null) {
  if (!lastActionType) return false;
  const normalized = lastActionType.toLowerCase();
  return normalized.includes("resubmit");
}

export function getStatusChip(status: string, lastActionType?: string | null) {
  switch (status) {
    case "pending_review":
      if (isResubmittedForReview(lastActionType)) {
        return {
          label: "RT",
          className: "border-blue-300 bg-blue-50 text-blue-700",
        };
      }
      return {
        label: "P",
        className: "border-blue-300 bg-blue-50 text-blue-700",
      };

    case "tech_followup_required":
      return {
        label: "FT",
        className: "border-red-300 bg-red-50 text-red-700",
      };

    case "sup_followup_required":
      return {
        label: "FS",
        className: "border-amber-300 bg-amber-50 text-amber-700",
      };

    case "approved":
      return {
        label: "A",
        className: "border-green-300 bg-green-50 text-green-700",
      };

    case "draft":
      return {
        label: "D",
        className: "border-slate-300 bg-slate-50 text-slate-700",
      };

    default:
      return {
        label: "?",
        className: "border-gray-300 bg-gray-50 text-gray-700",
      };
  }
}

export function getStatusBorder(status: string, lastActionType?: string | null) {
  switch (status) {
    case "pending_review":
      return "border-l-4 border-l-blue-500";

    case "tech_followup_required":
      return "border-l-4 border-l-red-500";

    case "sup_followup_required":
      return "border-l-4 border-l-amber-500";

    case "approved":
      return "border-l-4 border-l-green-500";

    default:
      return "border-l-4 border-l-gray-300";
  }
}

export function getPriority(status: string) {
  switch (status) {
    case "pending_review":
      return 1;

    case "tech_followup_required":
      return 2;

    case "sup_followup_required":
      return 3;

    case "approved":
      return 4;

    default:
      return 9;
  }
}

export function isEditableStatus(status: string, editUnlocked?: boolean) {
  if (status === "draft") return true;

  if (status === "tech_followup_required" && editUnlocked) {
    return true;
  }

  return false;
}