import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isCivilianRoute =
    path.startsWith("/civilian") &&
    !path.startsWith("/civilian/login") &&
    !path.startsWith("/civilian/signup");
  const isOfficerRoute =
    path.startsWith("/officer") && !path.startsWith("/officer/login");

  if (isCivilianRoute || isOfficerRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = isOfficerRoute ? "/officer/login" : "/civilian/login";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const wrongRoleForRoute =
      (isCivilianRoute && profile?.role !== "civilian") ||
      (isOfficerRoute && profile?.role !== "officer");

    if (wrongRoleForRoute) {
      const url = request.nextUrl.clone();
      url.pathname = isOfficerRoute ? "/officer/login" : "/civilian/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
