import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageShell";

type Props = {
  title: string;
  subtitle: string;
};

export function BpLeadStubPageShell(props: Props) {
  return (
    <PageShell>
      <PageHeader title={props.title} subtitle={props.subtitle} />

      <div id="shell-role-hint" data-shell-role="BP_LEAD" className="hidden" />

      <Card className="p-5">
        <div className="text-sm font-semibold">Delegation pending</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This surface is intentionally contained. BP Lead access will mirror BP Owner stubs until
          explicit BP Owner delegation is wired for selected eligible orgs.
        </p>
      </Card>
    </PageShell>
  );
}
