import { FieldLogRuntimeProvider } from "@/features/field-log/context/FieldLogRuntimeProvider";
import { FieldLogRuntimeGate } from "@/features/field-log/components/FieldLogRuntimeGate";
import FieldLogNewClient from "@/features/field-log/pages/FieldLogNewClient";

export const runtime = "nodejs";

export default function FieldLogNewPage() {
  return (
    <FieldLogRuntimeProvider>
      <FieldLogRuntimeGate>
        <FieldLogNewClient />
      </FieldLogRuntimeGate>
    </FieldLogRuntimeProvider>
  );
}