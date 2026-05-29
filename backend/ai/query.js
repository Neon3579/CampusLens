import { readJson, NOTICES_FILE, RESTAURANTS_FILE } from "../services/fileStore.js";
import { chat, OllamaUnavailableError } from "./ollamaClient.js";
import { filterSources } from "./filter.js";
import { buildFilterPrompt, buildAnswerPrompt } from "./prompts.js";

const NOTICE_CATEGORIES = ["학사", "장학", "취업", "행사", "기타"];

function unavailable(res, message) {
  return res.status(503).json({ error: "OLLAMA_UNAVAILABLE", message });
}

export default async function aiQuery(req, res, next) {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "질문이 비어 있습니다." });
    }

    const today = new Date();

    // 호출① — 필터스펙 추출
    let spec = {};
    try {
      const raw = await chat({
        messages: buildFilterPrompt(question, today, NOTICE_CATEGORIES),
        format: "json",
      });
      spec = JSON.parse(raw);
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        return unavailable(res, `${err.message} 'ollama serve' 실행과 모델 pull이 필요합니다.`);
      }
      spec = {}; // JSON 파싱 실패 → 전체 검색으로 폴백
    }

    const [notices, restaurants] = await Promise.all([
      readJson(NOTICES_FILE, []),
      readJson(RESTAURANTS_FILE, []),
    ]);

    const sources = filterSources(spec, notices, restaurants, today);

    if (sources.length === 0) {
      return res.json({
        answer: "관련 공지나 식당 정보를 찾지 못했습니다.",
        sources: [],
        filter: spec,
      });
    }

    // 호출② — 자연어 답변
    let answer;
    try {
      answer = await chat({ messages: buildAnswerPrompt(question, sources) });
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        return unavailable(res, err.message);
      }
      throw err;
    }

    res.json({ answer: answer.trim(), sources, filter: spec });
  } catch (err) {
    next(err);
  }
}
