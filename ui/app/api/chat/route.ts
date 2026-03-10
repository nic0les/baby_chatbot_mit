import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const backendRes = await fetch(`${BACKEND}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!backendRes.ok) {
      const err = await backendRes.text();
      return NextResponse.json({ error: err }, { status: backendRes.status });
    }

    // Proxy the stream directly to the browser
    return new Response(backendRes.body, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    // Friendly message if the Python backend isn't running
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return NextResponse.json(
        { error: "Backend offline — run: uvicorn app:app --reload --port 8000" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
