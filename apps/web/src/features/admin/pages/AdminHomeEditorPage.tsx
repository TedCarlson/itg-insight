// path: apps/web/src/features/admin/home-editor/pages/AdminHomeEditorPage.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useOrgConsoleAccess } from "@/hooks/useOrgConsoleAccess";
import { useOrg } from "@/state/org";
import { useSession } from "@/state/session";
import BlockEditor from "../home-editor/components/BlockEditor";
import { fetchBlocks, saveBlocks } from "../home-editor/lib/homeEditorApi";
import { defaultTemplate } from "../home-editor/lib/homeEditorTemplates";
import {
  AREA_LABEL,
  AREAS,
  type DraftBlock,
  type Lob,
  uid,
} from "../home-editor/lib/homeEditorTypes";

function configForBlockType(blockType: DraftBlock["block_type"]) {
  if (blockType === "narrative") return { subtitle: "", text: "" };

  if (blockType === "kpi_row") {
    return { subtitle: "", items: [{ label: "", value: "—", sub: "" }] };
  }

  return { items: [{ label: "", href: "", sub: "" }] };
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
  const scoped = Boolean(selectedOrgId);

  const grouped = useMemo(() => {
    const out: Record<string, DraftBlock[]> = {};

    for (const area of AREAS) out[area] = [];

    for (const block of draft) {
      const key = AREAS.includes(block.area as any) ? block.area : "left";
      out[key].push(block);
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

      const next: DraftBlock[] = rows.map((row: any) => ({
        _key: uid(),
        pc_org_home_block_id: String(row.pc_org_home_block_id),
        area: String(row.area ?? "left"),
        block_type: String(row.block_type ?? "narrative") as DraftBlock["block_type"],
        title: String(row.title ?? ""),
        config: row.config ?? {},
        is_enabled: row.is_enabled !== false,
      }));

      setDraft(next);
      setInfo("Loaded.");
    } catch (err: any) {
      setError(err?.message ?? "Load failed");
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

    void load();
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
    } catch (err: any) {
      setError(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addBlock(area: string, blockType: DraftBlock["block_type"]) {
    setDraft((previous) =>
      previous.concat({
        _key: uid(),
        area,
        block_type: blockType,
        title:
          blockType === "kpi_row"
            ? "Snapshot"
            : blockType === "link_list"
              ? "Quick Links"
              : "Narrative",
        config: configForBlockType(blockType),
        is_enabled: true,
      })
    );
  }

  function moveWithinArea(area: string, key: string, direction: -1 | 1) {
    setDraft((previous) => {
      const inArea = previous.filter((block) => block.area === area);
      const index = inArea.findIndex((block) => block._key === key);

      if (index < 0) return previous;

      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= inArea.length) return previous;

      const nextArea = [...inArea];
      const current = nextArea[index];
      nextArea[index] = nextArea[swapWith];
      nextArea[swapWith] = current;

      const rebuilt: DraftBlock[] = [];

      for (const candidateArea of AREAS) {
        const blocks =
          candidateArea === area
            ? nextArea
            : previous.filter((block) => block.area === candidateArea);

        rebuilt.push(...blocks);
      }

      const unknown = previous.filter(
        (block) => !AREAS.includes(block.area as any)
      );

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
        <p className="text-sm text-[var(--to-ink-muted)]">
          Customize the org homepage per PC and LOB using blocks.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-1">
            <div className="text-xs text-[var(--to-ink-muted)]">Editing</div>
            <div className="text-sm font-medium">
              PC:{" "}
              <span className="text-[var(--to-ink)]">
                {selectedOrgId ?? "(none)"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SegmentedControl
              value={lob}
              onChange={(value) => setLob(value as Lob)}
              options={[
                { value: "FULFILLMENT", label: "Fulfillment" },
                { value: "LOCATE", label: "Locate" },
              ]}
            />

            <Button
              type="button"
              variant="secondary"
              disabled={!scoped || loading}
              onClick={load}
            >
              Refresh
            </Button>

            <Button
              type="button"
              disabled={!scoped || !canEdit || saving}
              onClick={onSave}
            >
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
              <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                One-click starter blocks. Edit after loading.
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(defaultTemplate(lob));
                setInfo("Template loaded. Hit Save when ready.");
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
                    <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
                      area: {area}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => addBlock(area, "kpi_row")}
                    >
                      + KPI Row
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => addBlock(area, "narrative")}
                    >
                      + Narrative
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => addBlock(area, "link_list")}
                    >
                      + Link List
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {blocks.length ? (
                    blocks.map((block, index) => (
                      <BlockEditor
                        key={block._key}
                        block={block}
                        onChange={(next) =>
                          setDraft((previous) =>
                            previous.map((item) =>
                              item._key === block._key ? next : item
                            )
                          )
                        }
                        onDelete={() =>
                          setDraft((previous) =>
                            previous.filter((item) => item._key !== block._key)
                          )
                        }
                        onMoveUp={() => moveWithinArea(area, block._key, -1)}
                        onMoveDown={() => moveWithinArea(area, block._key, 1)}
                        disableMoveUp={index === 0}
                        disableMoveDown={index === blocks.length - 1}
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