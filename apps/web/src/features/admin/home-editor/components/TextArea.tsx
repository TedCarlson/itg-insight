// path: apps/web/src/features/admin/home-editor/components/TextArea.tsx

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
};

export default function TextArea({ value, onChange, rows = 7 }: Props) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded border px-3 py-2 text-sm outline-none"
      style={{
        borderColor: "var(--to-border)",
        background: "var(--to-surface)",
      }}
    />
  );
}