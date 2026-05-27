/**
 * File: server/services/ollama.js
 * Purpose: 크롤링된 공지 후보를 CampusLens 앱이 쓰는 구조화된 공지 JSON으로 정규화한다.
 * Notes: Ollama 호출 실패 시에도 데모가 동작하도록 규칙 기반 fallback 정규화 함수를 함께 제공한다.
 */

import { config } from "../config.js";

/**
 * noticeListSchema
 * Ollama JSON mode에 전달하는 공지 목록 응답 스키마이다.
 */
export const noticeListSchema = {
  type: "object",
  properties: {
    notices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          dept: { type: "string" },
          deadline: { type: "string" },
          summary: { type: "string" },
          sourceUrl: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" }
          },
          urgent: { type: "boolean" }
        },
        required: ["title", "category", "dept", "deadline", "summary", "sourceUrl", "tags", "urgent"]
      }
    }
  },
  required: ["notices"]
};

/**
 * coerceNotice
 * LLM 또는 fallback 결과의 필드를 안전한 기본값과 제한된 배열 길이로 보정한다.
 *
 * @param {object} item - 정규화 후보 공지 객체
 * @returns {object} 앱에서 사용하는 공지 객체
 */
function coerceNotice(item) {
  return {
    title: String(item.title || "").trim(),
    category: String(item.category || "공지").trim(),
    dept: String(item.dept || "전체").trim(),
    deadline: String(item.deadline || "").trim(),
    summary: String(item.summary || "").trim(),
    sourceUrl: String(item.sourceUrl || "").trim(),
    tags: Array.isArray(item.tags) ? item.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 5) : [],
    urgent: Boolean(item.urgent)
  };
}

/**
 * fallbackNormalizeNotices
 * LLM 없이 raw notice를 최소 표시 가능한 공지 구조로 변환한다.
 *
 * @param {Array<object>} rawItems - crawler.js가 수집한 raw notice 배열
 * @returns {Array<object>} 정규화된 공지 배열
 */
export function fallbackNormalizeNotices(rawItems = []) {
  return rawItems.map(item => ({
    title: item.title,
    category: "공지",
    dept: "전체",
    deadline: item.dateText || "",
    summary: item.text || item.title,
    sourceUrl: item.sourceUrl,
    tags: ["공지"],
    urgent: false
  })).map(coerceNotice);
}

/**
 * normalizeNoticesWithOllama
 * Ollama chat API에 raw notice 배열을 전달하고 스키마에 맞는 공지 목록을 받아 보정한다.
 *
 * @param {Array<object>} rawItems - 정규화할 raw notice 배열
 * @param {object} options - Ollama URL과 모델 override
 * @returns {Promise<Array<object>>} 정규화된 공지 배열
 */
export async function normalizeNoticesWithOllama(rawItems, options = {}) {
  const ollamaUrl = options.ollamaUrl || config.ollama.url;
  const model = options.model || config.ollama.model;

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return [];
  }

  const prompt = [
    "다음은 학교 웹사이트에서 수집한 공개 공지 후보 데이터입니다.",
    "CampusLens 앱에서 사용할 수 있도록 공지 배열을 정규화하세요.",
    "규칙:",
    "- category는 학사, 대회, 자격증, 비교과, 공지 중 가장 가까운 값으로 작성합니다.",
    "- dept를 알 수 없으면 전체로 작성합니다.",
    "- deadline은 명확한 마감일이 있으면 MM.DD 형식으로 작성하고, 없으면 빈 문자열로 둡니다.",
    "- summary는 한국어 한 문장으로 짧게 요약합니다.",
    "- tags는 1개에서 5개 사이의 짧은 한국어 키워드입니다.",
    "- urgent는 마감이 임박했거나 필수 안내로 보이면 true입니다.",
    "",
    "JSON Schema:",
    JSON.stringify(noticeListSchema),
    "",
    "수집 데이터:",
    JSON.stringify(rawItems, null, 2)
  ].join("\n");

  const response = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: noticeListSchema,
      messages: [
        {
          role: "system",
          content: "당신은 한국 대학 공지 데이터를 앱용 JSON으로 정규화하는 데이터 처리기입니다. 설명 없이 JSON만 반환합니다."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const error = new Error(`Ollama 요청 실패: ${response.status} ${response.statusText}`);
    error.status = 502;
    error.code = "OLLAMA_REQUEST_FAILED";
    throw error;
  }

  const payload = await response.json();
  const content = payload.message?.content || payload.response || "";
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    error.message = `Ollama JSON 파싱 실패: ${error.message}`;
    error.status = 502;
    error.code = "OLLAMA_PARSE_FAILED";
    throw error;
  }

  const notices = Array.isArray(parsed) ? parsed : parsed.notices;
  if (!Array.isArray(notices)) {
    const error = new Error("Ollama 응답에 notices 배열이 없습니다.");
    error.status = 502;
    error.code = "OLLAMA_SCHEMA_FAILED";
    throw error;
  }

  return notices.map(coerceNotice).filter(notice => notice.title);
}
