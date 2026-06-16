import { FieldLogReviewClient } from "@/features/field-log/pages/FieldLogReviewClient";

export default function FieldLogTnpsPage() {
  return (
    <div className="space-y-4">
      <FieldLogReviewClient viewMode="tnps" title="tNPS Records" />
    </div>
  );
}
