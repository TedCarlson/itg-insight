"use client";

import { useState } from "react";
import type { ScorecardResponse, ScorecardTile } from "../lib/scorecard.types";
import ScorecardIdentityCard from "./ScorecardIdentityCard";
import PersonJumpSelect from "./PersonJumpSelect";
import ScorecardOrgPills from "./ScorecardOrgPills";
import KpiTileGrid from "./KpiTileGrid";
import KpiDrawer from "./KpiDrawer";

export default function TechScorecardClient(props: {
  payload: ScorecardResponse;
}) {
  const { payload } = props;
  const [openTile, setOpenTile] = useState<ScorecardTile | null>(null);

  function onOpen(tile: ScorecardTile) {
    setOpenTile(tile);
  }

  function onClose() {
    setOpenTile(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <PersonJumpSelect />
      </div>

      <ScorecardIdentityCard header={payload.header} />

      <ScorecardOrgPills
        personId={payload.header.person_id}
        options={payload.org_selector}
      />

      <KpiTileGrid tiles={payload.tiles} onOpen={onOpen} />
      <KpiDrawer tile={openTile} onClose={onClose} />
    </div>
  );
}