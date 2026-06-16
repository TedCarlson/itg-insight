import { FieldLogReviewClient } from "@/features/field-log/pages/FieldLogReviewClient";

export default function FieldLogCasesPage() {
  return (
    <div className="space-y-4">
      <FieldLogReviewClient viewMode="cases" title="Case Management" />
    </div>
  );
}
