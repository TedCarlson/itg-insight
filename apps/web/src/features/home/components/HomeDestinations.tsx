import Link from "next/link";
import type { HomePayload } from "../lib/getHomePayload.server";

function Card(props: {
  label: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={props.href}
      className="block rounded-2xl border bg-card p-4 transition hover:bg-muted/10"
    >
      <div className="text-sm font-semibold">{props.label}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {props.description}
      </div>
    </Link>
  );
}

export default function HomeDestinations(props: {
  payload: HomePayload;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Your Workspace
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {props.payload.destinations.map((d) => (
          <Card
            key={d.href}
            label={d.label}
            description={d.description}
            href={d.href}
          />
        ))}
      </div>
    </section>
  );
}