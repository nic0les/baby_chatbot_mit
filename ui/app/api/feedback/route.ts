import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch("http://localhost:8000/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: "backend error" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    // Best-effort — don't break the UI if backend is down
    return NextResponse.json({ ok: false });
  }
}
