// apps/web/src/features/roster/hooks/rosterRowModule.actions.ts
import { api, type RosterDrilldownRow, type RosterMasterRow } from "@/shared/lib/api";

export type PositionTitleRow = {
  position_title: string;
  sort_order?: number | null;
  active?: boolean | null;
};

export async function loadPositionTitlesAction(args: {
  pcOrgId: string; // kept for future scoping, even if meta route is global
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setRows: (rows: PositionTitleRow[]) => void;
}) {
  const { setLoading, setError, setRows } = args;
  setLoading(true);
  setError(null);

  try {
    const res = await fetch("/api/meta/position-titles", { method: "GET" });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = (json as any)?.error || (json as any)?.message || `Failed to load position titles (${res.status})`;
      setError(String(msg));
      setRows([]);
      return;
    }

    // ✅ Accept multiple shapes:
    // 1) [...]
    // 2) { data: [...] }
    // 3) { ok: true, titles: [...] }  <-- your server helper
    const list =
      Array.isArray(json)
        ? json
        : Array.isArray((json as any)?.titles)
          ? (json as any).titles
          : Array.isArray((json as any)?.data)
            ? (json as any).data
            : [];

    const rows: PositionTitleRow[] = (list ?? [])
      .filter((t: any) => t && typeof t.position_title === "string")
      .map((t: any) => ({
        position_title: String(t.position_title),
        sort_order: t.sort_order ?? null,
        active: t.active ?? null,
      }));

    setRows(rows);
  } catch (e: any) {
    setError(e?.message ?? "Failed to load position titles");
    setRows([]);
  } finally {
    setLoading(false);
  }
}

export async function loadMasterAction(args: {
  pcOrgId: string;
  setLoading: (v: boolean) => void;
  setErr: (v: string | null) => void;
  setRows: (rows: RosterMasterRow[] | null) => void;
}) {
  const { pcOrgId, setLoading, setErr, setRows } = args;

  setLoading(true);
  setErr(null);

  try {
    const data = await api.rosterMaster(pcOrgId);
    setRows((data ?? []) as any);
  } catch (e: any) {
    setErr(e?.message ?? "Failed to load roster master");
    setRows(null);
  } finally {
    setLoading(false);
  }
}

export async function loadDrilldownAction(args: {
  pcOrgId: string;
  setLoading: (v: boolean) => void;
  setErr: (v: string | null) => void;
  setRows: (rows: RosterDrilldownRow[] | null) => void;
}) {
  const { pcOrgId, setLoading, setErr, setRows } = args;

  setLoading(true);
  setErr(null);

  try {
    const data = await api.rosterDrilldown(pcOrgId);
    setRows((data ?? []) as any);
  } catch (e: any) {
    setErr(e?.message ?? "Failed to load roster drilldown");
    setRows(null);
  } finally {
    setLoading(false);
  }
}

export async function sendInviteAction(args: {
  assignmentId: string;
  email: string;

  setStatus: (v: "idle" | "sending" | "sent" | "error") => void;
  setErr: (v: string | null) => void;
  setOk: (v: string | null) => void;
}) {
  const { assignmentId, email, setStatus, setErr, setOk } = args;

  if (!assignmentId) {
    setErr("No assignment_id on this roster row — cannot invite.");
    setStatus("error");
    return;
  }

  const trimmed = String(email ?? "").trim();
  if (!trimmed) {
    setErr("Email is required.");
    setStatus("error");
    return;
  }

  setStatus("sending");
  setErr(null);
  setOk(null);

  try {
    const res = await fetch("/api/workforce/app-access/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: String(assignmentId) }),
    });

    const json = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      const top =
        (json && ((json as any).error || (json as any).message)) ||
        (res.status === 403 ? "Not authorized to invite." : "Invite failed.");

      const d = (json as any)?.details;
      const detailMsg =
        (d && (d.message || d.error_description || d.error)) ||
        (typeof d === "string" ? d : d ? JSON.stringify(d) : "");

      const redirectTo = (json as any)?.redirect_to ? `redirect_to=${String((json as any).redirect_to)}` : "";

      setErr(`${String(top)}${detailMsg ? ` — ${detailMsg}` : ""}${redirectTo ? ` — ${redirectTo}` : ""}`);
      setStatus("error");
      return;
    }

    setStatus("sent");

    const rt = (json as any)?.redirect_to ? String((json as any).redirect_to) : "";
    const nxt = (json as any)?.post_password_next ? String((json as any).post_password_next) : "";
    setOk(`Invite sent. redirect_to=${rt || "?"}${nxt ? ` • post_password_next=${nxt}` : ""}`);
  } catch (e: any) {
    setErr(e?.message ?? "Invite failed.");
    setStatus("error");
  }
}