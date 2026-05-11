// path: apps/web/src/features/admin/home-editor/lib/homeEditorApi.ts

import type { DraftBlock, Lob } from "./homeEditorTypes";
import { AREAS } from "./homeEditorTypes";

export async function fetchBlocks(pc_org_id: string, lob: Lob) {
  const res = await fetch(
    `/api/home/blocks?pc_org_id=${encodeURIComponent(pc_org_id)}&lob=${lob}`,
    { method: "GET" }
  );

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    const msg = json?.error ?? `HTTP ${res.status}`;
    const details = json?.details ? `: ${json.details}` : "";
    throw new Error(msg + details);
  }

  return (json.rows ?? []) as Array<any>;
}

export async function saveBlocks(
  pc_org_id: string,
  lob: Lob,
  blocks: DraftBlock[]
) {
  const rows: Array<any> = [];

  for (const area of AREAS) {
    const group = blocks.filter((block) => block.area === area);

    group.forEach((block, index) => {
      rows.push({
        area: block.area,
        sort: index * 10,
        block_type: block.block_type,
        title: block.title || null,
        config: block.config ?? {},
        is_enabled: block.is_enabled !== false,
      });
    });
  }

  const res = await fetch("/api/home/blocks", {
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