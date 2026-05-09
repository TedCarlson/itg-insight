// path: apps/web/src/components/navigation/GrantChipPill.tsx

"use client";

export type GrantChip = {
  key: "RM" | "RL" | "MM";
  label: string;
  tooltip: string;
};

type Props = {
  chip: GrantChip;
};

export default function GrantChipPill(props: Props) {
  return (
    <div
      title={props.chip.tooltip}
      className="inline-flex items-center justify-center rounded-md border bg-background/70 px-2 py-1 text-[10px] font-semibold tracking-wide text-foreground"
    >
      {props.chip.label}
    </div>
  );
}