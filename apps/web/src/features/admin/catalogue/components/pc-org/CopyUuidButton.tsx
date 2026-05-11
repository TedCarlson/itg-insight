// path: apps/web/src/features/admin/catalogue/components/pc-org/CopyUuidButton.tsx

"use client";

type Props = {
  value: string;
};

export default function CopyUuidButton({ value }: Props) {
  return (
    <button
      type="button"
      className="to-btn inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: "var(--to-border)" }}
      onClick={async () => {
        await navigator.clipboard.writeText(String(value));
      }}
      title="Copy UUID"
    >
      Copy
    </button>
  );
}