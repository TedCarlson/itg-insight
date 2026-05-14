"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { EntryType, LogRow, WorkforceRow } from "../lib/types";
import { buildAutoDraft } from "../lib/labels";

type DraftArgs = {
  selectedAssignmentId: string | null;
  setSelectedAssignmentId: (v: string | null) => void;
  selectedTech: WorkforceRow | null;
};

function norm(v: unknown) {
  return String(v ?? "").trim();
}

function labelForEntryType(t: EntryType) {
  if (t === "CALL_OUT") return "Call Out";
  if (t === "ADD_IN") return "Add In";
  if (t === "BP_LOW") return "BP-Low";
  if (t === "INCIDENT") return "Incident";
  if (t === "TECH_MOVE") return "Tech Move";
  return "Note";
}

function mutateMessagePrefix(prevType: EntryType, nextType: EntryType, curMessage: string) {
  const prev = `${labelForEntryType(prevType)} — `;
  const next = `${labelForEntryType(nextType)} — `;
  const msg = curMessage ?? "";

  if (msg.startsWith(prev)) return `${next}${msg.slice(prev.length)}`;
  if (norm(msg).length === 0) return next.trimEnd();
  return msg;
}

function routeIdForTech(row: WorkforceRow | null) {
  return norm(row?.planned_route_id);
}

function routeNameForTech(row: WorkforceRow | null) {
  return norm(row?.planned_route_name);
}

export function useDispatchConsoleDraft(args: DraftArgs) {
  const { selectedTech } = args;

  const [entryType, setEntryType] = useState<EntryType | null>(null);
  const [message, setMessage] = useState("");

  const [techMoveToRouteId, setTechMoveToRouteId] = useState<string>("");
  const [techMoveToRouteName, setTechMoveToRouteName] = useState<string>("");

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingIsNote, setEditingIsNote] = useState<boolean>(false);

  const lastAutoDraftRef = useRef<string>("");

  const editing = Boolean(editingLogId);
  const effectiveAssignmentId = editing ? (editingAssignmentId ?? null) : (args.selectedAssignmentId ?? null);
  const typeLocked = editing && editingIsNote;

  const resetTechMoveDestination = useCallback(() => {
    setTechMoveToRouteId("");
    setTechMoveToRouteName("");
  }, []);

  const onSelectAssignment = useCallback(
    (aid: string | null) => {
      args.setSelectedAssignmentId(aid);
      lastAutoDraftRef.current = "";
      resetTechMoveDestination();

      if (!editing) {
        setEntryType(null);
        setMessage("");
      }
    },
    [args, editing, resetTechMoveDestination]
  );

  const setTechMoveDestination = useCallback((routeId: string, routeName: string) => {
    setTechMoveToRouteId(norm(routeId));
    setTechMoveToRouteName(norm(routeName));
  }, []);

  const setEntryTypeWithDraftMutation = useCallback(
    (nextType: EntryType) => {
      if (typeLocked) return;

      if (nextType !== "TECH_MOVE") {
        resetTechMoveDestination();
      }

      setEntryType((prev) => {
        if (editing) {
          if (prev) {
            setMessage((cur) => mutateMessagePrefix(prev, nextType, cur));
          } else if (selectedTech) {
            setMessage(buildAutoDraft(nextType, selectedTech));
          }
          return nextType;
        }

        if (selectedTech) {
          const nextAuto = buildAutoDraft(nextType, selectedTech);
          const cur = norm(message);
          const lastAuto = norm(lastAutoDraftRef.current);

          const safeToReplace = cur.length === 0 || cur === lastAuto;
          if (safeToReplace) {
            setMessage(nextAuto);
            lastAutoDraftRef.current = nextAuto;
          } else {
            lastAutoDraftRef.current = nextAuto;
          }
        }

        return nextType;
      });
    },
    [typeLocked, resetTechMoveDestination, editing, selectedTech, message]
  );

  const clearDraft = useCallback(() => {
    setMessage("");
    lastAutoDraftRef.current = "";
    setEntryType(null);
    resetTechMoveDestination();
    args.setSelectedAssignmentId(null);
    setEditingLogId(null);
    setEditingAssignmentId(null);
    setEditingIsNote(false);
  }, [args, resetTechMoveDestination]);

  const cancelEdit = useCallback(() => {
    setEditingLogId(null);
    setEditingAssignmentId(null);
    setEditingIsNote(false);
    setMessage("");
    lastAutoDraftRef.current = "";
    setEntryType(null);
    resetTechMoveDestination();
  }, [resetTechMoveDestination]);

  const beginEdit = useCallback(
    (row: LogRow) => {
      setEditingLogId(row.dispatch_console_log_id);

      const aid = norm(row.assignment_id);
      setEditingAssignmentId(aid ? aid : null);

      const isNote = row.event_type === "NOTE";
      setEditingIsNote(isNote);

      setEntryType(isNote ? "NOTE" : row.event_type);
      setMessage(row.message ?? "");

      const meta = row.meta ?? {};
      setTechMoveToRouteId(norm(meta.to_route_id));
      setTechMoveToRouteName(norm(meta.to_route_name));

      lastAutoDraftRef.current = "";
    },
    []
  );

  const techMoveFromRouteId = routeIdForTech(selectedTech);
  const techMoveFromRouteName = routeNameForTech(selectedTech);

  const canSubmit = useMemo(() => {
    const hasMsg = norm(message).length > 0;
    if (!hasMsg) return false;

    if (editing && editingIsNote) return true;
    if (!entryType) return false;

    if (entryType === "TECH_MOVE") {
      return Boolean(effectiveAssignmentId && techMoveToRouteId);
    }

    if (entryType !== "NOTE") return Boolean(effectiveAssignmentId);
    return true;
  }, [message, entryType, effectiveAssignmentId, editing, editingIsNote, techMoveToRouteId]);

  return {
    selectedAssignmentId: args.selectedAssignmentId,
    onSelectAssignment,

    entryType,
    setEntryType: setEntryTypeWithDraftMutation,
    message,
    setMessage,

    techMoveFromRouteId,
    techMoveFromRouteName,
    techMoveToRouteId,
    techMoveToRouteName,
    setTechMoveDestination,

    editingLogId,
    editingAssignmentId,
    editing,
    effectiveAssignmentId,
    editingIsNote,
    typeLocked,

    beginEdit,
    cancelEdit,
    clearDraft,

    canSubmit,
  };
}