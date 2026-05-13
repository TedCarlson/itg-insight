// path: apps/web/src/features/route-lock/history/lib/buildTechHistoryExportFilename.ts

function cleanPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

export function buildTechHistoryExportFilename(args: {
  techId?: string | null;
  fullName?: string | null;
  fromDate: string;
  toDate: string;
  extension: "xlsx" | "pdf";
}) {
  const techId = cleanPart(args.techId) || "unknown-tech";
  const fullName = cleanPart(args.fullName) || "unknown-name";

  return `tech-history_${techId}_${fullName}_${args.fromDate}_to_${args.toDate}.${args.extension}`;
}