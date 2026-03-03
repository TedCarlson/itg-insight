// RUN THIS
// Replace the entire file:
// apps/web/src/features/dispatch-console/hooks/useDispatchConsoleDraft.ts

"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { EntryType, LogRow, WorkforceRow } from "../lib/types";
import { buildAutoDraft } from "../lib/labels";

type DraftArgs = {
  initialEntryType?: EntryType;

  // create-mode context (page-owned)
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

export function useDispatchConsoleDraft(args: DraftArgs) {
  const { selectedTech } = args;

  // Draft fields
  const [entryType, setEntryType] = useState<EntryType>(args.initialEntryType ?? "NOTE");
  const [message, setMessage] = useState("");

  // Edit-mode state (ISOLATED from workforce selection)
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingIsNote, setEditingIsNote] = useState<boolean>(false);

  // Tracks last auto-draft produced (create-mode only)
  const lastAutoDraftRef = useRef<string>("");

  const editing = Boolean(editingLogId);

  // In edit mode, assignment context comes from the row being edited
  const effectiveAssignmentId = editing ? (editingAssignmentId ?? null) : (args.selectedAssignmentId ?? null);

  // NOTE guardrail:
  // - If editing a NOTE row, type is locked (message-only edits)
  const typeLocked = editing && editingIsNote;

  const onSelectAssignment = useCallback(
    (aid: string | null) => {
      args.setSelectedAssignmentId(aid);
      lastAutoDraftRef.current = "";
    },
    [args]
  );

  const onSelectedTechContext = useCallback(() => {
    if (!selectedTech) return;
    if (editing) return; // edit isolated

    const nextAuto = buildAutoDraft(entryType, selectedTech);
    const cur = norm(message);
    const lastAuto = norm(lastAutoDraftRef.current);

    const safeToReplace = cur.length === 0 || cur === lastAuto;
    if (safeToReplace) {
      setMessage(nextAuto);
      lastAutoDraftRef.current = nextAuto;
    }
  }, [selectedTech, editing, entryType, message]);

  const setEntryTypeWithDraftMutation = useCallback(
    (nextType: EntryType) => {
      if (typeLocked) return;

      setEntryType((prev) => {
        if (editing) {
          // edit-mode (non-note): prefix only
          setMessage((cur) => mutateMessagePrefix(prev, nextType, cur));
          return nextType;
        }

        // create-mode: auto draft if safe
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
    [typeLocked, editing, selectedTech, message]
  );

  const clearDraft = useCallback(() => {
    setMessage("");
    lastAutoDraftRef.current = "";
    setEntryType(args.initialEntryType ?? "NOTE");

    // Clear create-mode selection
    args.setSelectedAssignmentId(null);

    // Clear edit-mode
    setEditingLogId(null);
    setEditingAssignmentId(null);
    setEditingIsNote(false);
  }, [args]);

  const cancelEdit = useCallback(() => {
    setEditingLogId(null);
    setEditingAssignmentId(null);
    setEditingIsNote(false);
    setMessage("");
    lastAutoDraftRef.current = "";
    setEntryType(args.initialEntryType ?? "NOTE");
  }, [args.initialEntryType]);

  const beginEdit = useCallback((row: LogRow) => {
    setEditingLogId(row.dispatch_console_log_id);

    const aid = norm(row.assignment_id);
    setEditingAssignmentId(aid ? aid : null);

    const isNote = row.event_type === "NOTE";
    setEditingIsNote(isNote);

    // NOTE edit = NOTE locked
    setEntryType(isNote ? "NOTE" : row.event_type);
    setMessage(row.message ?? "");

    lastAutoDraftRef.current = "";
  }, []);

  const canSubmit = useMemo(() => {
    const hasMsg = norm(message).length > 0;
    if (!hasMsg) return false;

    // Editing NOTE: message-only save is allowed (no assignment requirement)
    if (editing && editingIsNote) return true;

    // For non-NOTE, require assignment context.
    if (entryType !== "NOTE") return Boolean(effectiveAssignmentId);

    // NOTE can be org-level OR tied to assignment.
    return true;
  }, [message, entryType, effectiveAssignmentId, editing, editingIsNote]);

  return {
    // create-mode selection (page-owned)
    selectedAssignmentId: args.selectedAssignmentId,
    onSelectAssignment,

    // draft fields
    entryType,
    setEntryType: setEntryTypeWithDraftMutation,
    setEntryTypeWithDraftMutation,
    message,
    setMessage,

    // edit-mode
    editingLogId,
    editingAssignmentId,
    editing,
    effectiveAssignmentId,
    editingIsNote,
    typeLocked,

    beginEdit,
    cancelEdit,
    clearDraft,

    // create-mode helper
    onSelectedTechContext,

    // computed
    canSubmit,
  };
}