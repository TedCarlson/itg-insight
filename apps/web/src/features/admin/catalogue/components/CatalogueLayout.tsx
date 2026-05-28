import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { TableCardGrid } from "./TableCardGrid";

export function CatalogueLayout(props: {
  selectedTable: string | null;
  onSelectTable: (key: string) => void;
  children: ReactNode;
}) {
  const { selectedTable, onSelectTable, children } = props;

  return (
    <div className="grid gap-4 pt-4 md:grid-cols-[320px_1fr] items-start">
      {/* Left: fixed-width rail card */}
      <Card variant="elevated" className="p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold">Catalogue</div>
          <div className="mt-1 text-sm text-[var(--to-ink-muted)]">
            Select a table.
          </div>
        </div>

        <TableCardGrid selectedTable={selectedTable} onSelectTable={onSelectTable} />
      </Card>

      {/* Right: workspace card, fits remaining */}
      <Card variant="elevated" className="p-4 min-h-[240px] overflow-hidden">
        {children}
      </Card>
    </div>
  );
}