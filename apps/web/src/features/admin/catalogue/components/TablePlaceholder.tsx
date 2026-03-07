import { ADMIN_TABLES } from "../lib/tables";
import { TableHeader } from "./TableHeader";
import { PersonTableView } from "./views/PersonTableView";
import { UserProfileTableView } from "./views/UserProfileTableView";
import { PcOrgTableView } from "./views/PcOrgTableView";
import { PcOrgOfficeTableView } from "./views/PcOrgOfficeTableView";
import { RegionTableView } from "./views/RegionTableView";
import { DivisionTableView } from "./views/DivisionTableView";
import { OfficeTableView } from "./views/OfficeTableView";
import { PcTableView } from "./views/PcTableView";
import { MsoTableView } from "./views/MsoTableView";
import { AssignmentTableView } from "./views/AssignmentTableView";

export function TablePlaceholder(props: { tableKey: string }) {
  const table = ADMIN_TABLES.find((t) => t.key === props.tableKey);
  if (!table) return null;

  if (table.key === "person") return <PersonTableView />;
  if (table.key === "user_profile") return <UserProfileTableView />;
  if (table.key === "pc_org") return <PcOrgTableView />;
  if (table.key === "pc_org_office") return <PcOrgOfficeTableView />;
  if (table.key === "region") return <RegionTableView />;
  if (table.key === "division") return <DivisionTableView />;
  if (table.key === "office") return <OfficeTableView />;
  if (table.key === "pc") return <PcTableView />;
  if (table.key === "mso") return <MsoTableView />;
  if (table.key === "assignment") return <AssignmentTableView />;

  return (
    <div className="grid gap-4">
      <TableHeader label={table.label} tableKey={table.key} />
      <div className="text-sm text-[var(--to-ink-muted)]">Data view and editing UI will render here.</div>
    </div>
  );
}