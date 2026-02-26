"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useSession } from "@/state/session";
import { useOrgConsoleAccess } from "@/hooks/useOrgConsoleAccess";

export default function FooterHelp() {
  const { isOwner } = useSession();
  const { canManageConsole } = useOrgConsoleAccess();

  const canSeeAdmin = isOwner || canManageConsole;

  return (
    <footer className="mt-10 py-6 border-t border-black/10 text-sm text-black/70 flex items-center justify-between">
      <div>
        Insight powered by TeamOptix
      </div>
    </footer>
  );
}