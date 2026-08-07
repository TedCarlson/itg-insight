import { getSupabaseServerClient } from "@/lib/supabase/server";

type SwitchboardRecord = {
  id: string;
  library_key: string;
  display_name: string;
  current_schema: string;
  current_object: string;
  object_type: string;
  status: "DISCOVERED" | "DEFINED" | "IMPLEMENTED" | "ACTIVE" | "RETIRED";
  source: "LEGACY" | "PLATFORM";
  notes: string | null;
  discovered_at: string;
  updated_at: string;
};

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "legacy" | "platform" | "discovered";
}) {
  const toneClass =
    tone === "legacy"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : tone === "platform"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : tone === "discovered"
          ? "border-blue-300 bg-blue-50 text-blue-800"
          : "border-slate-300 bg-slate-50 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

export default async function PlatformPage() {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_platform_switchboard");

  const records = (data ?? []) as SwitchboardRecord[];

  const schemaCount = new Set(records.map((record) => record.current_schema)).size;
  const legacyCount = records.filter((record) => record.source === "LEGACY").length;
  const platformCount = records.filter(
    (record) => record.source === "PLATFORM",
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
          Team Optix · Platform
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Switchboard
        </h1>

        <p className="max-w-4xl text-sm leading-6 text-slate-600">
          First-pass inventory of reusable concepts discovered in the active
          database schema. Nothing gets added to Platform unless it first has a
          Switchboard record.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Discovered records
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {records.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Schemas represented
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {schemaCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Authority
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-950">
            {legacyCount} Legacy · {platformCount} Platform
          </p>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">
            Switchboard could not be loaded
          </h2>
          <p className="mt-2 text-sm text-red-800">{error.message}</p>
        </section>
      ) : null}

      {!error && records.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="font-semibold text-slate-950">
            No Switchboard records found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Apply the Platform Switchboard migration to populate the first
            discovery inventory.
          </p>
        </section>
      ) : null}

      {records.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Library
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Current object
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Type
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Source
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Notes
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">
                        {record.display_name}
                      </p>
                      <code className="mt-1 block text-xs text-slate-500">
                        {record.library_key}
                      </code>
                    </td>

                    <td className="px-4 py-4">
                      <code className="text-xs text-slate-700">
                        {record.current_schema}.{record.current_object}
                      </code>
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {record.object_type}
                    </td>

                    <td className="px-4 py-4">
                      <Badge tone="discovered">{record.status}</Badge>
                    </td>

                    <td className="px-4 py-4">
                      <Badge
                        tone={
                          record.source === "PLATFORM"
                            ? "platform"
                            : "legacy"
                        }
                      >
                        {record.source}
                      </Badge>
                    </td>

                    <td className="max-w-md px-4 py-4 text-sm leading-5 text-slate-600">
                      {record.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
