import { NextResponse } from "next/server";
import {
  isAdminPasswordConfigured,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export async function GET(request: Request) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set on the server." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = auth.slice("Bearer ".length).trim();
  if (!token || !verifyAdminSessionToken(token)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
