// apps/web/src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type CallbackType = "recovery" | "invite" | "magiclink" | "email_change";

function pickNext(u: URL) {
  const all = u.searchParams.getAll("next");
  const n = all.length ? all[all.length - 1] : null;
  if (!n || !n.startsWith("/")) return "/";
  return n;
}

function ensureSetPasswordNext(type: CallbackType | null, rawNext: string) {
  const force = type === "invite" || type === "recovery" || type === "magiclink";
  if (!force) return rawNext;

  if (rawNext.startsWith("/auth/set-password")) return rawNext;
  return `/auth/set-password?next=${encodeURIComponent(rawNext)}`;
}

function shouldForceSetPasswordFromUser(user: any): boolean {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const appMeta = (user?.app_metadata ?? {}) as Record<string, unknown>;

  const inviteSource =
    typeof meta.invite_source === "string" ? meta.invite_source : null;

  const passwordSet =
    meta.password_set === true ||
    appMeta.password_set === true ||
    meta.passwordSet === true ||
    appMeta.passwordSet === true;

  if (passwordSet) return false;
  if (inviteSource) return true;

  return false;
}

async function resolvePostAuthNext(
  supabase: ReturnType<typeof createServerClient>,
  rawType: CallbackType | null,
  rawNext: string
) {
  if (rawType) {
    return ensureSetPasswordNext(rawType, rawNext);
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return rawNext;
  }

  if (shouldForceSetPasswordFromUser(data.user)) {
    return ensureSetPasswordNext("invite", rawNext);
  }

  return rawNext;
}

function buildFallback(url: URL, next: string, reason: string) {
  const fallback = new URL("/login", url.origin);
  fallback.searchParams.set("error", "auth_callback_failed");
  fallback.searchParams.set("reason", reason);
  fallback.searchParams.set("next", next);
  return fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const token = url.searchParams.get("token");
  const type = (url.searchParams.get("type") as CallbackType | null) ?? null;

  const rawNext = pickNext(url);

  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let redirectTarget = rawNext;
  let res = NextResponse.redirect(new URL(redirectTarget, url.origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // 1) PKCE exchange (OAuth / invite / magic link using code)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        buildFallback(url, ensureSetPasswordNext(type, rawNext), error.message)
      );
    }

    redirectTarget = await resolvePostAuthNext(supabase, type, rawNext);
    res = NextResponse.redirect(new URL(redirectTarget, url.origin));
    return res;
  }

  // 2) OTP verify using token_hash
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      return NextResponse.redirect(
        buildFallback(url, ensureSetPasswordNext(type, rawNext), error.message)
      );
    }

    redirectTarget = await resolvePostAuthNext(supabase, type, rawNext);
    res = NextResponse.redirect(new URL(redirectTarget, url.origin));
    return res;
  }

  // 3) OTP verify using token
  if (token && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: token });
    if (error) {
      return NextResponse.redirect(
        buildFallback(url, ensureSetPasswordNext(type, rawNext), error.message)
      );
    }

    redirectTarget = await resolvePostAuthNext(supabase, type, rawNext);
    res = NextResponse.redirect(new URL(redirectTarget, url.origin));
    return res;
  }

  /**
   * IMPORTANT:
   * If we get here, Supabase likely returned an implicit-style redirect where
   * access_token/refresh_token are in the URL fragment (#...), which the server cannot read.
   *
   * We must NOT redirect server-side (redirect drops the fragment). Instead, return a tiny HTML
   * page that does a client-side redirect to the computed destination while preserving window.location.hash.
   *
   * For fragment-based flows, we still use query-param type when present. If type is absent,
   * SetPasswordClient will recover by inspecting session/tokens client-side.
   */
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Completing sign-in…</title>
</head>
<body>
  <p style="font-family: system-ui; padding: 16px;">Completing sign-in…</p>
  <script>
    (function () {
      try {
        var params = new URLSearchParams(window.location.search);
        var type = params.get("type");

        var nextAll = params.getAll("next");
        var rawNext = (nextAll.length ? nextAll[nextAll.length - 1] : "/") || "/";
        if (typeof rawNext !== "string" || rawNext[0] !== "/") rawNext = "/";

        var force = (type === "invite" || type === "recovery" || type === "magiclink");
        var next = rawNext;
        if (force && !rawNext.startsWith("/auth/set-password")) {
          next = "/auth/set-password?next=" + encodeURIComponent(rawNext);
        }

        var hash = window.location.hash || "";
        window.location.replace(next + hash);
      } catch (e) {
        window.location.replace("/login");
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}