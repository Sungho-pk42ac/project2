"use client";

import { useState } from "react";

// ── 응답 스키마 타입 (서버 /api/analyze 와 일치) ──
type Level = "low" | "medium" | "high";

interface Competitor {
  name: string;
  url: string | null;
  description: string;
  similarity: number;
  differentiator: string;
}

interface DemandSignal {
  signal: string;
  evidence_type: string;
  confidence: Level;
}

interface AnalysisResult {
  idea_summary: string;
  overall: { novelty_score: number; recommendation: string };
  duplication: {
    risk: Level;
    score: number;
    rationale: string;
    existing_examples: string[];
  };
  competitors: Competitor[];
  demand: {
    demand_level: Level;
    target_audience: string;
    signals: DemandSignal[];
  };
}

// 레벨(한글 라벨 + 색상) 매핑
const LEVEL_META: Record<Level, { label: string; cls: string }> = {
  low: { label: "낮음", cls: "badge-low" },
  medium: { label: "보통", cls: "badge-mid" },
  high: { label: "높음", cls: "badge-high" },
};

const EXAMPLES = [
  "AI가 냉장고 사진을 보고 레시피를 추천하는 앱",
  "프리랜서를 위한 자동 세금계산 SaaS",
  "반려동물 산책 메이트 매칭 서비스",
];

export default function Home() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  /**
   * 아이디어를 서버에 보내 분석 결과를 받아온다.
   * 로딩/에러/결과 상태를 관리한다.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = idea.trim();
    if (!trimmed) {
      setError("아이디어를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "분석에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      setResult(data as AnalysisResult);
    } catch {
      setError("네트워크 오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <h1>💡 아이디어 검증기</h1>
        <p className="subtitle">
          제품 아이디어를 한 줄로 입력하면 <b>중복 가능성·경쟁자·시장 수요</b>를 분석해 드려요.
        </p>
        <p className="disclaimer">
          ※ gpt-4o-mini 기반 분석으로, 모든 결과는 <b>추정치</b>이며 confidence 라벨로 신뢰도를 표시합니다.
        </p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="예: AI가 냉장고 사진을 보고 레시피를 추천하는 앱"
          rows={3}
          maxLength={500}
          disabled={loading}
        />
        <div className="form-row">
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="chip"
                disabled={loading}
                onClick={() => setIdea(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
          <button type="submit" className="submit" disabled={loading}>
            {loading ? "분석 중…" : "검증하기"}
          </button>
        </div>
      </form>

      {error && (
        <div className="card error-card" role="alert">
          <strong>⚠️ {error}</strong>
          <button className="retry" onClick={() => handleSubmit({ preventDefault() {} } as React.FormEvent)}>
            다시 시도
          </button>
        </div>
      )}

      {loading && <LoadingSkeleton />}

      {result && !loading && <Results result={result} />}
    </main>
  );
}

/** 로딩 중 표시되는 스켈레톤 카드 3장 + 상태 텍스트 */
function LoadingSkeleton() {
  return (
    <section className="results">
      <p className="status">🔎 공개정보를 분석하는 중이에요…</p>
      <div className="grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card skeleton">
            <div className="sk-line w60" />
            <div className="sk-line w90" />
            <div className="sk-line w80" />
            <div className="sk-line w40" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** 분석 결과: 상단 종합 배너 + 3개 섹션 카드 */
function Results({ result }: { result: AnalysisResult }) {
  const dup = result.duplication;
  const demand = result.demand;
  return (
    <section className="results">
      <div className="banner">
        <div className="banner-score">
          <span className="score-num">{result.overall.novelty_score}</span>
          <span className="score-label">신규성 점수</span>
        </div>
        <div className="banner-text">
          <h2>{result.idea_summary}</h2>
          <p>{result.overall.recommendation}</p>
        </div>
      </div>

      <div className="grid">
        {/* 카드 1: 중복 가능성 */}
        <div className="card">
          <div className="card-head">
            <h3>① 중복 가능성</h3>
            <span className={`badge ${LEVEL_META[dup.risk]?.cls}`}>
              {LEVEL_META[dup.risk]?.label} · {dup.score}
            </span>
          </div>
          <p>{dup.rationale}</p>
          {dup.existing_examples?.length > 0 && (
            <ul>
              {dup.existing_examples.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          )}
        </div>

        {/* 카드 2: 유사/경쟁 프로젝트 */}
        <div className="card">
          <div className="card-head">
            <h3>② 유사·경쟁 프로젝트</h3>
            <span className="badge badge-mid">{result.competitors?.length || 0}곳</span>
          </div>
          <ul className="comp-list">
            {result.competitors?.map((c, i) => (
              <li key={i}>
                <div className="comp-top">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer">
                      {c.name}
                    </a>
                  ) : (
                    <span className="comp-name">{c.name}</span>
                  )}
                  <span className="sim">유사도 {c.similarity}</span>
                </div>
                <p className="comp-desc">{c.description}</p>
                <p className="comp-diff">↳ 차별점: {c.differentiator}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* 카드 3: 시장 수요 신호 */}
        <div className="card">
          <div className="card-head">
            <h3>③ 시장 수요 신호</h3>
            <span className={`badge ${LEVEL_META[demand.demand_level]?.cls}`}>
              수요 {LEVEL_META[demand.demand_level]?.label}
            </span>
          </div>
          <p className="audience">🎯 타겟: {demand.target_audience}</p>
          <ul className="signal-list">
            {demand.signals?.map((s, i) => (
              <li key={i}>
                <span className="signal-text">{s.signal}</span>
                <span className="signal-meta">
                  {s.evidence_type} · 신뢰도 {LEVEL_META[s.confidence]?.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
