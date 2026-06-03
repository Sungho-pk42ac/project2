// OpenAI 키 probe — 실호출 1회로 200 여부만 확인한다. 키 값은 절대 출력하지 않는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * .env.local 을 파싱해 key=value 맵으로 반환한다.
 * @param {string} path .env 파일 경로
 * @returns {Record<string,string>}
 */
function parseEnv(path) {
  const env = {};
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return env;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    env[k] = v;
  }
  return env;
}

const here = dirname(fileURLToPath(import.meta.url));
const env = parseEnv(join(here, "..", ".env.local"));
const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const model = env.OPENAI_MODEL || "gpt-4o-mini";

if (!apiKey || apiKey === "sk-REPLACE_ME") {
  console.log("RESULT: BLOCKED — .env.local 의 OPENAI_API_KEY 가 비었거나 PLACEHOLDER 그대로입니다.");
  process.exit(2);
}

try {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });

  if (res.ok) {
    console.log(`RESULT: 200 OK — model='${model}' 호출 성공. 프리플라이트 키 게이트 통과.`);
    process.exit(0);
  } else {
    let code = "";
    try {
      const body = await res.json();
      code = body?.error?.code || body?.error?.type || "";
    } catch {
      /* ignore */
    }
    console.log(`RESULT: FAIL — HTTP ${res.status} ${code ? `(${code})` : ""}`);
    process.exit(1);
  }
} catch (err) {
  console.log(`RESULT: NETWORK_ERROR — ${err?.message || err}`);
  process.exit(3);
}
