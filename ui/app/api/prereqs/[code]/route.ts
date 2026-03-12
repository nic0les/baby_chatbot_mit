import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const res = await fetch(
      `${BACKEND}/prereqs/${encodeURIComponent(params.code)}`
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 503 });
  }
}
