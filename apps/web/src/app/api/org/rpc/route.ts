// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/org/rpc/route.ts

import { NextRequest } from "next/server";
import { supabaseUserClient } from "@/shared/data/supabase/user";

import { RPC_ALLOWLIST, ONBOARD_GLOBAL_READS, type RpcRequest } from "./_rpc.types";
import { reqId, json, normalizeSchema, normalizeFn, parseCookies, extractPcOrgIdFromArgs } from "./_rpc.utils";
import {
  getSelectedPcOrgIdService,
  isOwnerUserClient,
  hasAnyRoleService,
  canAccessPcOrgUserClient,
  requirePermission,
  makeEnsureOrgScope,
} from "./_rpc.authz";
import {
  handleDefaultRpcAsUser,
  handleOnboardGlobalRead,
  handlePersonPcOrgEndAssociation,
  handlePersonUpsertServiceRole,
  handleAddToRosterServiceRole,
} from "./_rpc.handlers";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(req: NextRequest) {
  const rid = reqId();

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json(500, { ok: false, request_id: rid, error: "Missing Supabase env", code: "missing_env" });
    }

    const authHeader = req.headers.get("authorization") || "";
    const supabaseUser = supabaseUserClient({ authorization: authHeader });

    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
    const user = userRes?.user;

    if (userErr || !user) {
      const cookieHeader = req.headers.get("cookie");
      const cookieKeys = cookieHeader ? Object.keys(parseCookies(cookieHeader)) : [];
      return json(401, {
        ok: false,
        request_id: rid,
        error: "Unauthorized",
        code: "unauthorized",
        debug: {
          has_authorization_header: Boolean(req.headers.get("authorization")),
          cookie_key_count: cookieKeys.length,
          cookie_keys: cookieKeys.slice(0, 30),
        },
      });
    }

    const body = (await req.json().catch(() => ({}))) as RpcRequest;
    const schema = normalizeSchema(body?.schema ?? "api");
    const fn = normalizeFn(body?.fn);
    const rpcArgs = (body?.args ?? null) as any;

    if (!schema) return json(400, { ok: false, request_id: rid, error: "Invalid schema", code: "invalid_schema" });
    if (!fn) return json(400, { ok: false, request_id: rid, error: "Missing fn", code: "missing_fn" });

    if (!RPC_ALLOWLIST.has(fn)) {
      return json(403, { ok: false, request_id: rid, error: "RPC not allowed", code: "rpc_not_allowed", fn });
    }

    const userId = user.id;

    const selectedPcOrgId = await getSelectedPcOrgIdService(userId);
    const owner = await isOwnerUserClient(supabaseUser);
    const elevated = owner || (await hasAnyRoleService(userId, ["admin", "dev", "director", "vp"]));

    const ensureOrgScope = makeEnsureOrgScope({ rid, selectedPcOrgId, elevated });

    const pcOrgFromArgs = extractPcOrgIdFromArgs(rpcArgs);

    // Elevated users still must have baseline org access (prevents cross-org privilege).
    if (pcOrgFromArgs && elevated) {
      const ok = await canAccessPcOrgUserClient(supabaseUser, pcOrgFromArgs);
      if (!ok) {
        return json(403, {
          ok: false,
          request_id: rid,
          error: "Forbidden",
          code: "forbidden",
          debug: { reason: "elevated_but_no_baseline_access", pc_org_id: pcOrgFromArgs },
        });
      }
    }

    // Global onboard reads
    if (ONBOARD_GLOBAL_READS.has(fn)) {
      if (!selectedPcOrgId && !elevated) {
        return json(409, { ok: false, request_id: rid, error: "No selected org", code: "no_selected_pc_org" });
      }

      const allowed = await requirePermission(supabaseUser, selectedPcOrgId as string, "roster_manage", { elevated });
      if (!allowed) {
        return json(403, {
          ok: false,
          request_id: rid,
          error: "Forbidden",
          code: "forbidden",
          required_permission: "roster_manage",
          pc_org_id: selectedPcOrgId,
        });
      }

      return handleOnboardGlobalRead({ rid, fn, schema, rpcArgs });
    }

    // Sensitive permission RPCs (execute as user)
    if (
      fn === "permission_grant" ||
      fn === "permission_revoke" ||
      fn === "pc_org_eligibility_grant" ||
      fn === "pc_org_eligibility_revoke"
    ) {
      const scope = ensureOrgScope(pcOrgFromArgs);
      if (!scope.ok) return json(scope.status, scope.body);

      const allowed = await requirePermission(supabaseUser, pcOrgFromArgs, "permissions_manage", { elevated });
      if (!allowed) {
        return json(403, {
          ok: false,
          request_id: rid,
          error: "Forbidden",
          code: "forbidden",
          required_permission: "permissions_manage",
          pc_org_id: pcOrgFromArgs,
        });
      }

      return handleDefaultRpcAsUser({ rid, supabaseUser, schema, fn, rpcArgs });
    }

    // Direct table write: end association (service role)
    if (schema === "public" && fn === "person_pc_org_end_association") {
      const person_id = String(rpcArgs?.person_id ?? "").trim();
      const pc_org_id = String(rpcArgs?.pc_org_id ?? "").trim();
      const end_date_raw = rpcArgs?.end_date ? String(rpcArgs.end_date).trim() : "";
      const end_date = end_date_raw ? end_date_raw : new Date().toISOString().slice(0, 10);

      if (!person_id || !pc_org_id) {
        return json(400, { ok: false, request_id: rid, error: "Missing person_id or pc_org_id", code: "missing_keys" });
      }

      const scope = ensureOrgScope(pc_org_id);
      if (!scope.ok) return json(scope.status, scope.body);

      const allowed = await requirePermission(supabaseUser, pc_org_id, "roster_manage", { elevated });
      if (!allowed) {
        return json(403, {
          ok: false,
          request_id: rid,
          error: "Forbidden",
          code: "forbidden",
          required_permission: "roster_manage",
          pc_org_id,
        });
      }

      // IMPORTANT: handler expects ONLY { rid, person_id, pc_org_id, end_date }
      return handlePersonPcOrgEndAssociation({ rid, person_id, pc_org_id, end_date });
    }

    // person_upsert: service role (selected org gate)
    if (fn === "person_upsert") {
      if (!selectedPcOrgId && !elevated) {
        return json(409, { ok: false, request_id: rid, error: "No selected org", code: "no_selected_pc_org" });
      }

      const allowed = await requirePermission(supabaseUser, selectedPcOrgId as string, "roster_manage", { elevated });
      if (!allowed) return json(403, { ok: false, request_id: rid, error: "Forbidden", code: "forbidden" });

      return handlePersonUpsertServiceRole({ rid, fn: "person_upsert", schema, rpcArgs });
    }

    // Roster-manage gated writes
    if (fn === "add_to_roster" || fn === "assignment_start" || fn === "assignment_end" || fn === "assignment_patch") {
      const scope = ensureOrgScope(pcOrgFromArgs);
      if (!scope.ok) return json(scope.status, scope.body);

      const allowed = await requirePermission(supabaseUser, pcOrgFromArgs, "roster_manage", { elevated });
      if (!allowed) {
        return json(403, {
          ok: false,
          request_id: rid,
          error: "Forbidden",
          code: "forbidden",
          required_permission: "roster_manage",
          pc_org_id: pcOrgFromArgs,
        });
      }

      // add_to_roster uses service role (membership table)
      if (fn === "add_to_roster") {
        return handleAddToRosterServiceRole({ rid, schema, rpcArgs });
      }

      // everything else: execute as user
      return handleDefaultRpcAsUser({ rid, supabaseUser, schema, fn, rpcArgs });
    }

    // Default: execute as user
    return handleDefaultRpcAsUser({ rid, supabaseUser, schema, fn, rpcArgs });
  } catch (e: any) {
    return json(500, { ok: false, request_id: rid, error: e?.message ?? "Unknown error", code: "exception" });
  }
}