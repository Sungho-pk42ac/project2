import { NextResponse } from "next/server";

// Vercel 서버리스에서 항상 동적 실행되도록 강제 (env 주입을 런타임에 확인)
export const dynamic = "force-dynamic";

/**
 * GET /api/debug — 필요한 환경변수가 런타임에 주입됐는지 boolean 으로만 보고한다.
 * 키 값 자체는 절대 노출하지 않는다(존재 여부와 길이 유효성만).
 * @returns 각 env 키의 주입 여부를 담은 JSON
 */
export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  return NextResponse.json({
    OPENAI_API_KEY: typeof key === "string" && key.length > 0,
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",
  });
}
