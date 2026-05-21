import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/shared/data/supabase/server";
import { getHomePayload } from "@/features/home/lib/getHomePayload.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (!error && data?.user) {
    const home = await getHomePayload();

    if (home.role === "TECH") {
      redirect("/tech");
    }

    redirect("/home");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        ITG • Insight powered by TeamOptix
      </h1>
      <p className="text-base text-muted-foreground">
        Please sign in to continue.
      </p>

      <div className="flex gap-3">
        <Link
          className="to-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium"
          href="/login"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
