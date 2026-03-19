import type { HomePayload } from "../lib/getHomePayload.server";

export default function HomeHeader(props: {
  payload: HomePayload;
}) {
  const { payload } = props;

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="text-xl font-semibold">
        {payload.full_name ? `Welcome, ${payload.full_name}` : "Welcome"}
      </div>

      <div className="mt-2 text-sm text-muted-foreground">
        {payload.role.replaceAll("_", " ")} • {payload.org_label ?? "No Org"}
      </div>
    </section>
  );
}