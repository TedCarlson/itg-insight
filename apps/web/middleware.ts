// apps/web/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const OWNER_LANDING = "/";
const ACTIVE_LANDING = "/";

function isPublicUiPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname === "/favicon.ico"
  );
}

function isPublicApiPath(pathname: string) {
  return pathname.startsWith("/api/auth/");
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

const ALLOWED_NEXT_PREFIXES = [
  "/",
  "/home",
  "/welcome",
  "/admin",
  "/org",
  "/access",
  "/route-lock",
  "/metrics",
  "/locate",
] as const;

function isAllowedNextPath(pathname: string) {
  return ALLOWED_NEXT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function safeNextParam(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith("/")) return "/";
  if (!isAllowedNextPath(pathname)) return "/";
  return pathname + (req.nextUrl.search || "");
}

const DISALLOWED_NEXT_PREFIXES = ["/login", "/access", "/auth"] as const;

function isDisallowedNextPath(pathname: string) {
  return DISALLOWED_NEXT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function safeNextFromQuery(req: NextRequest, fallback: string) {
  const raw = req.nextUrl.searchParams.get("next");
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  const pathname = raw.split("?")[0].split("#")[0];

  if (isDisallowedNextPath(pathname)) return fallback;
  if (!isAllowedNextPath(pathname)) return fallback;

  return pathname;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/dev/kit") && process.env.NODE_ENV !== "development") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  let res = NextResponse.next({ request: { headers: req.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return res;
  }

  if (isPublicUiPath(pathname) || isPublicApiPath(pathname)) {
    return res;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session ?? null;
  const user = session?.user ?? null;

  if (!user) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", safeNextParam(req));
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/login")) {
    const dest = safeNextFromQuery(req, OWNER_LANDING);
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = dest;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  let isOwner = false;
  try {
    const { data } = await supabase.rpc("is_owner");
    isOwner = Boolean(data);
  } catch {
    isOwner = false;
  }

  let shouldCheckWelcome = false;

  if (!isOwner) {
    const { data: profile, error: profileErr } = await supabase
      .from("user_profile")
      .select("status, person_id, core_person_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      if (isApiPath(pathname)) {
        return NextResponse.json({ ok: false, error: "forbidden_inactive" }, { status: 403 });
      }

      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/access";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    if (profile.status !== "active") {
      if (isApiPath(pathname)) {
        return NextResponse.json({ ok: false, error: "forbidden_inactive" }, { status: 403 });
      }

      if (pathname.startsWith("/access")) return res;

      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/access";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    shouldCheckWelcome = Boolean(profile.core_person_id ?? profile.person_id);
  }

  if (
    shouldCheckWelcome &&
    !isApiPath(pathname) &&
    !pathname.startsWith("/welcome") &&
    !pathname.startsWith("/access")
  ) {
    const { data: facts, error: factsErr } = await supabase
      .from("app_access_session_fact")
      .select("session_fact_id")
      .eq("auth_user_id", user.id)
      .limit(1);

    if (!factsErr && (!Array.isArray(facts) || facts.length === 0)) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/welcome";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (pathname.startsWith("/access")) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = ACTIVE_LANDING;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};