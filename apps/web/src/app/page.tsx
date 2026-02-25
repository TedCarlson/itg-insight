import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/shared/data/supabase/server";

const UI_ONLY = process.env.NEXT_PUBLIC_DISPATCH_CONSOLE_UI_ONLY === "1";

async function rpcBoolWithFallback(supabase: any, fn: string, auth_user_id?: string): Promise<boolean> {
  const apiClient: any = (supabase as any).schema ? (supabase as any).schema("api") : supabase;

  const attempts =
    fn === "is_owner"
      ? [{}]
      : [{ p_auth_user_id: auth_user_id }, { auth_user_id }];

  for (const args of attempts) {
    const { data, error } = await apiClient.rpc(fn, args);
    if (error) return false;
    return Boolean(data);
  }
  return false;
}

export default async function Page() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (UI_ONLY) redirect("/dispatch-console");

    const uid = user.id;
    const [isOwner, isItg, isBp] = await Promise.all([
      rpcBoolWithFallback(supabase, "is_owner"),
      rpcBoolWithFallback(supabase, "is_itg_supervisor", uid),
      rpcBoolWithFallback(supabase, "is_bp_supervisor", uid),
    ]);

    if (isOwner || isItg || isBp) redirect("/dispatch-console");
    redirect("/fulfillment");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">ITG • Insight powered by TeamOptix</h1>
      <p className="text-base text-muted-foreground">Please sign in to continue.</p>

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