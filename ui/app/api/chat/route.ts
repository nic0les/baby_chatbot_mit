import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an MIT Course Advisor chatbot. You help MIT students navigate the course catalog intelligently.

You have deep knowledge of:
- MIT's General Institute Requirements (GIRs): Science Core (6 subjects), HASS (8 subjects including CI-H), REST (2 subjects), Lab (1 subject)
- Course numbering: 6-xxx = EECS, 18-xxx = Math, 8-xxx = Physics, 5-xxx = Chemistry, 7-xxx = Biology, 24-xxx = Philosophy, etc.
- Distribution attributes: CI-H (Communication Intensive - Humanities), CI-M (Communication Intensive - Major), HASS-H, HASS-S, HASS-A, REST
- Common majors and their requirements: 6-1 EE, 6-2 EECS, 6-3 CS, 6-4 AI & Decision Making, 18C Math w/ CS, etc.
- Prerequisite chains, unit loads, and how courses connect
- MIT time slot system: 8.5 (8:30-9:30), 9.5 (9:30-10:30), 10 (10-11), 10.5 (10:30-11:30), 11 (11-12), 12 (12-1), 1 (1-2), 2 (2-3), 3 (3-4), 4 (4-5), EVE (evenings)

When a student describes their situation, help them by:
1. Identifying hard constraints (prerequisites, unit limits, graduation requirements not yet met)
2. Understanding soft preferences (interests, time of day, workload, class size)
3. Recommending specific courses with real MIT course numbers and titles
4. Explaining WHY each course fits their situation
5. Being transparent about uncertainty — if you're unsure of current semester offerings, say so

Always include course numbers (e.g., "6.3900 — Introduction to Machine Learning") and be specific. Keep responses focused and practical. If the student mentions courses they've taken or uploads a CourseRoad file, use that to inform your recommendations.`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ message: text });
  } catch (error) {
    console.error("Chat error:", error);
    const msg =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
