// proxy.ts
// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same mechanism, new name
// — see node_modules/next/dist/docs/.../file-conventions/proxy.md). Two jobs:
//   1. Refresh the Supabase session cookie on every request that isn't a
//      static asset, so a logged-in user's session doesn't silently expire
//      mid-browse (this is the standard @supabase/ssr proxy/middleware
//      pattern — required per createServerClient's own docs, which warn
//      that skipping this "will cause significant and difficult to debug
//      authentication issues").
//   2. Redirect unauthenticated requests away from the pages that require an
//      account. API routes are deliberately excluded from the matcher below
//      and instead check auth themselves — Next's own proxy docs warn against
//      relying on proxy as the only line of defense for those.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";

const PROTECTED_PREFIXES = ["/deals", "/dashboard", "/settings"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
