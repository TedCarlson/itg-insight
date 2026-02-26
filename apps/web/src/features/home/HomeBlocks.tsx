"use client";

import { Card } from "@/components/ui/Card";
import type { HomeBlock } from "@/features/home/useHomeBlocks";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function BlockKpiRow({ title, config }: { title: string | null; config: any }) {
  const items: Array<{ label: string; value: string; sub?: string }> = Array.isArray(config?.items) ? config.items : [];

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{title ?? "Snapshot"}</div>
          {config?.subtitle ? (
            <div className="mt-1 text-[11px] text-[var(--to-ink-muted)]">{String(config.subtitle)}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.length ? (
          items.map((it, idx) => (
            <div key={idx} className="rounded-lg border bg-background/60 p-3">
              <div className="text-[11px] text-[var(--to-ink-muted)]">{it.label}</div>
              <div className="mt-1 text-lg font-semibold leading-tight">{it.value}</div>
              {it.sub ? <div className="mt-1 text-[11px] text-[var(--to-ink-muted)]">{it.sub}</div> : null}
            </div>
          ))
        ) : (
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="text-[11px] text-[var(--to-ink-muted)]">No KPI items configured</div>
            <div className="mt-1 text-sm">Add config.items[]</div>
          </div>
        )}
      </div>
    </Card>
  );
}

function BlockNarrative({ title, config }: { title: string | null; config: any }) {
  const text = config?.text ? String(config.text) : "";
  return (
    <Card>
      <div className="text-sm font-medium">{title ?? "Narrative"}</div>
      {config?.subtitle ? (
        <div className="mt-1 text-[11px] text-[var(--to-ink-muted)]">{String(config.subtitle)}</div>
      ) : null}
      <div className="mt-3 rounded-lg border bg-background/60 p-3">
        <div className="text-sm whitespace-pre-wrap">{text || "—"}</div>
      </div>
    </Card>
  );
}

function BlockLinkList({ title, config }: { title: string | null; config: any }) {
  const items: Array<{ label: string; href: string; sub?: string }> = Array.isArray(config?.items) ? config.items : [];
  return (
    <Card>
      <div className="text-sm font-medium">{title ?? "Links"}</div>
      {config?.subtitle ? (
        <div className="mt-1 text-[11px] text-[var(--to-ink-muted)]">{String(config.subtitle)}</div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((it, idx) => (
            <a
              key={idx}
              href={it.href}
              className={cls("rounded-lg border bg-background/60 p-3 hover:bg-muted/40", "block")}
            >
              <div className="text-sm font-medium">{it.label}</div>
              {it.sub ? <div className="mt-1 text-[11px] text-[var(--to-ink-muted)]">{it.sub}</div> : null}
              <div className="mt-1 text-[11px] text-[var(--to-ink-muted)] truncate">{it.href}</div>
            </a>
          ))
        ) : (
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="text-[11px] text-[var(--to-ink-muted)]">No links configured</div>
            <div className="mt-1 text-sm">Add config.items[]</div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function HomeBlocks({ blocks }: { blocks: HomeBlock[] }) {
  return (
    <div className="grid gap-3">
      {blocks.map((b) => {
        const t = String(b.block_type ?? "");
        if (t === "kpi_row") return <BlockKpiRow key={b.pc_org_home_block_id} title={b.title} config={b.config} />;
        if (t === "narrative") return <BlockNarrative key={b.pc_org_home_block_id} title={b.title} config={b.config} />;
        if (t === "link_list") return <BlockLinkList key={b.pc_org_home_block_id} title={b.title} config={b.config} />;

        return (
          <Card key={b.pc_org_home_block_id}>
            <div className="text-sm font-medium">{b.title ?? "Unknown block"}</div>
            <div className="mt-1 text-[11px] text-[var(--to-ink-muted)]">block_type: {t}</div>
          </Card>
        );
      })}
    </div>
  );
}