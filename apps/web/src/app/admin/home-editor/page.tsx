"use client";

import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";

import { useOrg } from "@/state/org";
import { useSession } from "@/state/session";
import { useOrgConsoleAccess } from "@/hooks/useOrgConsoleAccess";

type Lob = "FULFILLMENT" | "LOCATE";

type DraftBlock = {
  _key: string; // client-only key
  pc_org_home_block_id?: string;
  area: string;
  block_type: "kpi_row" | "narrative" | "link_list";
  title: string;
  config: any;
  is_enabled: boolean;
};

const AREAS = ["header", "kpis", "left", "right", "footer"] as const;
const AREA_LABEL: Record<(typeof AREAS)[number], string> = {
  header: "Header",
  kpis: "KPI Row",
  left: "Left Column",
  right: "Right Column",
  footer: "Footer",
};

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `k_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

function defaultTemplate(lob: Lob): DraftBlock[] {
  if (lob === "LOCATE") {
    return [
      {
        _key: uid(),
        area: "kpis",
        block_type: "kpi_row",
        title: "Locate Snapshot",
        is_enabled: true,
        config: {
          subtitle: "Start simple; wire data sources later",
          items: [
            { label: "Tickets Open", value: "—", sub: "Current backlog" },
            { label: "Past Due", value: "—", sub: "Aging volume" },
            { label: "Emergency", value: "—", sub: "Rolling avg" },
            { label: "Daily Log", value: "—", sub: "Entries today" },
          ],
        },
      },
      {
        _key: uid(),
        area: "left",
        block_type: "narrative",
        title: "Trend Narrative",
        is_enabled: true,
        config: { subtitle: "What changed and why", text: "" },
      },
      {
        _key: uid(),
        area: "right",
        block_type: "link_list",
        title: "Quick Links",
        is_enabled: true,
        config: {
          items: [
            { label: "Daily Log", href: "/locate/daily-log", sub: "Log + review" },
            { label: "Roster", href: "/roster", sub: "Membership + assignment" },
          ],
        },
      },
    ];
  }

  return [
    {
      _key: uid(),
      area: "kpis",
      block_type: "kpi_row",
      title: "PC Snapshot",
      is_enabled: true,
      config: {
        subtitle: "Replace placeholders with real rollups next",
        items: [
          { label: "Headcount", value: "—", sub: "Roster active" },
          { label: "Quota Coverage", value: "—", sub: "Days meeting quota" },
          { label: "Shift Validation", value: "—", sub: "Next 14-day window" },
          { label: "Route Lock Health", value: "—", sub: "Exceptions + readiness" },
        ],
      },
    },
    {
      _key: uid(),
      area: "left",
      block_type: "narrative",
      title: "Today’s Focus",
      is_enabled: true,
      config: { subtitle: "Supervisor narrative", text: "" },
    },
    {
      _key: uid(),
      area: "right",
      block_type: "link_list",
      title: "Quick Links",
      is_enabled: true,
      config: {
        items: [
          { label: "Route Lock Calendar", href: "/route-lock/calendar", sub: "Current & next fiscal month" },
          { label: "Shift Validation", href: "/route-lock/shift-validation", sub: "14-day forward window" },
          { label: "Roster", href: "/roster", sub: "Membership + assignment" },
        ],
      },
    },
  ];
}

async function fetchBlocks(pc_org_id: string, lob: Lob) {
  const res = await fetch(`/api/home/blocks?pc_org_id=${encodeURIComponent(pc_org_id)}&lob=${lob}`, { method: "GET" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    const msg = json?.error ?? `HTTP ${res.status}`;
    const details = json?.details ? `: ${json.details}` : "";
    throw new Error(msg + details);
  }
  return (json.rows ?? []) as Array<any>;
}

async function saveBlocks(pc_org_id: string, lob: Lob, blocks: DraftBlock[]) {
  // Recompute sort per area from current order
  const rows: Array<any> = [];
  for (const area of AREAS) {
    const group = blocks.filter((b) => b.area === area);
    group.forEach((b, idx) => {
      rows.push({
        area: b.area,
        sort: idx * 10,
        block_type: b.block_type,
        title: b.title || null,
        config: b.config ?? {},
        is_enabled: b.is_enabled !== false,
      });
    });
  }

  const res = await fetch(`/api/home/blocks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pc_org_id, lob, rows }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    const msg = json?.error ?? `HTTP ${res.status}`;
    const details = json?.details ? `: ${json.details}` : "";
    throw new Error(msg + details);
  }
}

function TextArea({ value, onChange, rows = 7 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border px-3 py-2 text-sm outline-none"
      style={{ borderColor: "var(--to-border)", background: "var(--to-surface)" }}
    />
  );
}

function BlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}: {
  block: DraftBlock;
  onChange: (next: DraftBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableMoveUp: boolean;
  disableMoveDown: boolean;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--to-border)", background: "var(--to-surface)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <div className="to-label">Title</div>
              <TextInput value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} />
            </div>
            <div>
              <div className="to-label">Type</div>
              <Select
                value={block.block_type}
                onChange={(e) => {
                  const nextType = e.target.value as DraftBlock["block_type"];
                  const nextConfig =
                    nextType === "narrative"
                      ? { subtitle: "", text: "" }
                      : nextType === "kpi_row"
                        ? { subtitle: "", items: [{ label: "", value: "—", sub: "" }] }
                        : { items: [{ label: "", href: "", sub: "" }] };

                  onChange({ ...block, block_type: nextType, config: nextConfig });
                }}
              >
                <option value="kpi_row">KPI Row</option>
                <option value="narrative">Narrative</option>
                <option value="link_list">Link List</option>
              </Select>
            </div>
          </div>

          <div className="mt-3">
            {block.block_type === "narrative" ? (
              <>
                <div className="to-label">Subtitle (optional)</div>
                <TextInput
                  value={String(block.config?.subtitle ?? "")}
                  onChange={(e) => onChange({ ...block, config: { ...(block.config ?? {}), subtitle: e.target.value } })}
                />
                <div className="to-label mt-3">Text</div>
                <TextArea
                  value={String(block.config?.text ?? "")}
                  onChange={(v) => onChange({ ...block, config: { ...(block.config ?? {}), text: v } })}
                />
              </>
            ) : block.block_type === "kpi_row" ? (
              <>
                <div className="to-label">Subtitle (optional)</div>
                <TextInput
                  value={String(block.config?.subtitle ?? "")}
                  onChange={(e) => onChange({ ...block, config: { ...(block.config ?? {}), subtitle: e.target.value } })}
                />

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-medium">KPI items</div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const items = Array.isArray(block.config?.items) ? [...block.config.items] : [];
                      items.push({ label: "", value: "—", sub: "" });
                      onChange({ ...block, config: { ...(block.config ?? {}), items } });
                    }}
                  >
                    Add item
                  </Button>
                </div>

                <div className="mt-2 grid gap-2">
                  {(Array.isArray(block.config?.items) ? block.config.items : []).map((it: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-3"
                      style={{ borderColor: "var(--to-border)", background: "var(--to-surface-2)" }}
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <div className="to-label">Label</div>
                          <TextInput
                            value={String(it?.label ?? "")}
                            onChange={(e) => {
                              const items = [...block.config.items];
                              items[idx] = { ...items[idx], label: e.target.value };
                              onChange({ ...block, config: { ...(block.config ?? {}), items } });
                            }}
                          />
                        </div>
                        <div>
                          <div className="to-label">Value</div>
                          <TextInput
                            value={String(it?.value ?? "")}
                            onChange={(e) => {
                              const items = [...block.config.items];
                              items[idx] = { ...items[idx], value: e.target.value };
                              onChange({ ...block, config: { ...(block.config ?? {}), items } });
                            }}
                          />
                        </div>
                        <div>
                          <div className="to-label">Sub</div>
                          <TextInput
                            value={String(it?.sub ?? "")}
                            onChange={(e) => {
                              const items = [...block.config.items];
                              items[idx] = { ...items[idx], sub: e.target.value };
                              onChange({ ...block, config: { ...(block.config ?? {}), items } });
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            const items = [...block.config.items];
                            items.splice(idx, 1);
                            onChange({ ...block, config: { ...(block.config ?? {}), items } });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-sm font-medium">Links</div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const items = Array.isArray(block.config?.items) ? [...block.config.items] : [];
                      items.push({ label: "", href: "", sub: "" });
                      onChange({ ...block, config: { ...(block.config ?? {}), items } });
                    }}
                  >
                    Add link
                  </Button>
                </div>

                <div className="mt-2 grid gap-2">
                  {(Array.isArray(block.config?.items) ? block.config.items : []).map((it: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-3"
                      style={{ borderColor: "var(--to-border)", background: "var(--to-surface-2)" }}
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <div className="to-label">Label</div>
                          <TextInput
                            value={String(it?.label ?? "")}
                            onChange={(e) => {
                              const items = [...block.config.items];
                              items[idx] = { ...items[idx], label: e.target.value };
                              onChange({ ...block, config: { ...(block.config ?? {}), items } });
                            }}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="to-label">Href</div>
                          <TextInput
                            value={String(it?.href ?? "")}
                            onChange={(e) => {
                              const items = [...block.config.items];
                              items[idx] = { ...items[idx], href: e.target.value };
                              onChange({ ...block, config: { ...(block.config ?? {}), items } });
                            }}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <div className="to-label">Sub</div>
                          <TextInput
                            value={String(it?.sub ?? "")}
                            onChange={(e) => {
                              const items = [...block.config.items];
                              items[idx] = { ...items[idx], sub: e.target.value };
                              onChange({ ...block, config: { ...(block.config ?? {}), items } });
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            const items = [...block.config.items];
                            items.splice(idx, 1);
                            onChange({ ...block, config: { ...(block.config ?? {}), items } });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 sm:flex-col sm:items-stretch">
          <Button type="button" variant="secondary" disabled={disableMoveUp} onClick={onMoveUp}>
            Up
          </Button>
          <Button type="button" variant="secondary" disabled={disableMoveDown} onClick={onMoveDown}>
            Down
          </Button>
          <Button type="button" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminHomeEditorPage() {
  const { ready, signedIn, isOwner } = useSession();
  const { selectedOrgId } = useOrg();
  const { canManageConsole, error: accessError } = useOrgConsoleAccess();

  const [lob, setLob] = useState<Lob>("FULFILLMENT");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [draft, setDraft] = useState<DraftBlock[]>([]);

  const canEdit = isOwner || canManageConsole;
  const scoped = !!selectedOrgId;

  const grouped = useMemo(() => {
    const out: Record<string, DraftBlock[]> = {};
    for (const a of AREAS) out[a] = [];
    for (const b of draft) {
      const k = AREAS.includes(b.area as any) ? b.area : "left";
      out[k].push(b);
    }
    return out;
  }, [draft]);

  async function load() {
    if (!selectedOrgId) return;

    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const rows = await fetchBlocks(selectedOrgId, lob);
      const next: DraftBlock[] = (rows ?? []).map((r: any) => ({
        _key: uid(),
        pc_org_home_block_id: String(r.pc_org_home_block_id),
        area: String(r.area ?? "left"),
        block_type: String(r.block_type ?? "narrative") as any,
        title: String(r.title ?? ""),
        config: r.config ?? {},
        is_enabled: r.is_enabled !== false,
      }));
      setDraft(next);
      setInfo("Loaded.");
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
      setDraft([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready || !signedIn) return;
    if (!selectedOrgId) {
      setDraft([]);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, selectedOrgId, lob]);

  async function onSave() {
    if (!selectedOrgId) return;

    setError(null);
    setInfo(null);
    setSaving(true);

    try {
      await saveBlocks(selectedOrgId, lob, draft);
      setInfo("Saved.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addBlock(area: string, block_type: DraftBlock["block_type"]) {
    const config =
      block_type === "narrative"
        ? { subtitle: "", text: "" }
        : block_type === "kpi_row"
          ? { subtitle: "", items: [{ label: "", value: "—", sub: "" }] }
          : { items: [{ label: "", href: "", sub: "" }] };

    setDraft((prev) =>
      prev.concat({
        _key: uid(),
        area,
        block_type,
        title: block_type === "kpi_row" ? "Snapshot" : block_type === "link_list" ? "Quick Links" : "Narrative",
        config,
        is_enabled: true,
      })
    );
  }

  function moveWithinArea(area: string, key: string, dir: -1 | 1) {
    setDraft((prev) => {
      const inArea = prev.filter((b) => b.area === area);
      const idx = inArea.findIndex((b) => b._key === key);
      if (idx < 0) return prev;

      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= inArea.length) return prev;

      const nextArea = [...inArea];
      const tmp = nextArea[idx];
      nextArea[idx] = nextArea[swapWith];
      nextArea[swapWith] = tmp;

      const rebuilt: DraftBlock[] = [];
      for (const a of AREAS) {
        const arr = a === area ? nextArea : prev.filter((b) => b.area === a);
        rebuilt.push(...arr);
      }
      // plus unknown areas (shouldn't happen)
      const unknown = prev.filter((b) => !AREAS.includes(b.area as any));
      rebuilt.push(...unknown);

      return rebuilt;
    });
  }

  const gateMessage = !scoped
    ? "Select a PC in the left rail, then come back here."
    : accessError
      ? `Console access check error: ${accessError}`
      : !canEdit
        ? "You don’t have permission to edit homepage blocks for this PC."
        : null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Home Editor</h1>
        <p className="text-sm text-[var(--to-ink-muted)]">Customize the org homepage (per PC + LOB) using blocks.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Editing</div>
            <div className="text-sm font-medium">
              PC: <span className="text-[var(--to-ink)]">{selectedOrgId ?? "(none)"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SegmentedControl
              value={lob}
              onChange={(v) => setLob(v as Lob)}
              options={[
                { value: "FULFILLMENT", label: "Fulfillment" },
                { value: "LOCATE", label: "Locate" },
              ]}
            />

            <Button type="button" variant="secondary" disabled={!scoped || loading} onClick={load}>
              Refresh
            </Button>

            <Button type="button" disabled={!scoped || !canEdit || saving} onClick={onSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      {gateMessage ? (
        <Notice variant="warning" title="Not ready">
          {gateMessage}
        </Notice>
      ) : null}

      {error ? (
        <Notice variant="danger" title="Error">
          {error}
        </Notice>
      ) : null}

      {info ? (
        <Notice variant="success" title="OK">
          {info}
        </Notice>
      ) : null}

      {scoped && canEdit ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">Templates</div>
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">One-click starter blocks (edit after).</div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(defaultTemplate(lob));
                setInfo("Template loaded (not saved yet). Hit Save.");
              }}
            >
              Load default template
            </Button>
          </div>
        </Card>
      ) : null}

      {scoped && canEdit ? (
        <div className="grid gap-4">
          {AREAS.map((area) => {
            const blocks = grouped[area] ?? [];
            return (
              <Card key={area}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">{AREA_LABEL[area]}</div>
                    <div className="mt-1 text-xs text-[var(--to-ink-muted)]">area: {area}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => addBlock(area, "kpi_row")}>
                      + KPI Row
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => addBlock(area, "narrative")}>
                      + Narrative
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => addBlock(area, "link_list")}>
                      + Link List
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {blocks.length ? (
                    blocks.map((b, idx) => (
                      <BlockEditor
                        key={b._key}
                        block={b}
                        onChange={(next) => setDraft((prev) => prev.map((x) => (x._key === b._key ? next : x)))}
                        onDelete={() => setDraft((prev) => prev.filter((x) => x._key !== b._key))}
                        onMoveUp={() => moveWithinArea(area, b._key, -1)}
                        onMoveDown={() => moveWithinArea(area, b._key, 1)}
                        disableMoveUp={idx === 0}
                        disableMoveDown={idx === blocks.length - 1}
                      />
                    ))
                  ) : (
                    <Notice title="Empty" variant="info">
                      No blocks in this area.
                    </Notice>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}