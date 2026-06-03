import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // 서버리스 함수 타임아웃 상향 (LLM 응답 대기 여유)

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// LLM 에게 요구하는 출력 스키마 설명 (한국어). 프롬프트와 UI 렌더링을 동시에 결정한다.
const SYSTEM_PROMPT = `당신은 제품 아이디어를 검증하는 OSINT 분석가입니다.
사용자가 제시한 제품 아이디어를 분석해 반드시 아래 JSON 스키마에 정확히 맞는 객체만 반환하세요.
모든 텍스트는 한국어로 작성합니다. 추측이 섞인 항목은 confidence 라벨로 정직하게 표시하세요.
당신의 지식은 컷오프가 있으므로 url 이 불확실하면 null 로 두세요.

반환 JSON 스키마:
{
  "idea_summary": string,                       // 아이디어를 정규화한 한 줄 재진술
  "overall": {
    "novelty_score": number,                    // 0~100, 신규성/독창성
    "recommendation": string                    // 1~2문장 종합 결론
  },
  "duplication": {
    "risk": "low" | "medium" | "high",
    "score": number,                            // 0~100, 중복 가능성
    "rationale": string,
    "existing_examples": string[]               // 동일/거의동일 사례 0~3개
  },
  "competitors": [                              // 3~5개
    {
      "name": string,
      "url": string | null,
      "description": string,
      "similarity": number,                     // 0~100
      "differentiator": string                  // 이 아이디어가 다른 점
    }
  ],
  "demand": {
    "demand_level": "low" | "medium" | "high",
    "target_audience": string,
    "signals": [                               // 2~4개
      {
        "signal": string,
        "evidence_type": string,               // 예: "커뮤니티 언급", "검색 트렌드 추정"
        "confidence": "low" | "medium" | "high"
      }
    ]
  }
}
오직 이 JSON 만 출력하고 다른 설명은 절대 덧붙이지 마세요.`;

/**
 * 응답 객체가 필수 구조를 갖췄는지 얕게 검증한다.
 * @param data 파싱된 JSON 객체
 * @returns 유효하면 true
 */
function isValidResult(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.idea_summary === "string" &&
    typeof d.overall === "object" &&
    typeof d.duplication === "object" &&
    Array.isArray(d.competitors) &&
    typeof d.demand === "object"
  );
}

/**
 * OpenAI 에 1회 분석을 요청하고 파싱된 결과를 반환한다.
 * @param client OpenAI 클라이언트
 * @param idea 사용자 아이디어
 * @returns 파싱·검증된 결과 객체 또는 null(실패)
 */
async function requestAnalysis(client: OpenAI, idea: string): Promise<unknown | null> {
  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `다음 제품 아이디어를 분석해줘:\n\n${idea}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/analyze — 아이디어를 받아 구조화 분석 결과를 반환한다.
 * 입력 검증 → OpenAI 호출 → 파싱 실패 시 1회 재시도 → 결과/에러 반환.
 */
export async function POST(req: NextRequest) {
  // 1) 입력 검증
  let idea = "";
  try {
    const body = await req.json();
    idea = typeof body?.idea === "string" ? body.idea.trim() : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  if (!idea) {
    return NextResponse.json({ error: "아이디어를 입력해 주세요." }, { status: 400 });
  }
  if (idea.length > 500) {
    return NextResponse.json({ error: "아이디어는 500자 이내로 입력해 주세요." }, { status: 400 });
  }

  // 2) 키 확인 (서버 전용)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버 설정 오류로 분석을 수행할 수 없습니다." },
      { status: 500 }
    );
  }

  const client = new OpenAI({ apiKey });

  // 3) 분석 호출 (파싱 실패 시 1회 자동 재시도)
  try {
    let result = await requestAnalysis(client, idea);
    if (result === null) {
      result = await requestAnalysis(client, idea);
    }
    if (result === null) {
      return NextResponse.json(
        { error: "분석 결과를 해석하지 못했어요. 다시 시도해 주세요." },
        { status: 502 }
      );
    }
    return NextResponse.json(result, { status: 200 });
  } catch {
    // 키/스택트레이스 등 내부 정보는 절대 노출하지 않는다.
    return NextResponse.json(
      { error: "분석에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }
}
