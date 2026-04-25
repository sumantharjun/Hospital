import { NextRequest, NextResponse } from "next/server";

const ADMIN_ROLES = ["SUPER_ADMIN", "HOSPITAL_ADMIN"];
const RECEPTIONIST_ROLES = ["RECEPTIONIST", "HOSPITAL_ADMIN", "SUPER_ADMIN"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/" || pathname === "/signup") {
    return NextResponse.next();
  }

  const token = request.cookies.get("clinic_token")?.value;
  const role = request.cookies.get("clinic_role")?.value;

  if (!token || !role) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/admin") && !ADMIN_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/reception") && !RECEPTIONIST_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
