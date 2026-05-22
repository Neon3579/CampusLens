/**
 * File: server/config.js
 * Purpose: Express 서버, CORS, 세션, Ollama 연동에 필요한 환경설정을 한곳에서 조립한다.
 * Notes: process.env 값을 직접 여러 파일에서 읽지 않도록 이 모듈이 안정적인 기본값과 파싱 규칙을 제공한다.
 */

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * parseInteger
 * 환경변수 문자열을 양의 정수로 변환하고 실패하면 fallback을 사용한다.
 *
 * @param {unknown} value - 정수로 해석할 값
 * @param {number} fallback - 파싱 실패 시 사용할 기본값
 * @returns {number} 양의 정수 설정값
 */
function parseInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * parseOriginList
 * 쉼표로 구분된 CORS origin 문자열을 공백이 제거된 배열로 바꾼다.
 *
 * @param {string} value - CORS_ORIGINS 환경변수 값
 * @returns {Array<string>} 허용 origin 배열
 */
function parseOriginList(value = "") {
  return String(value)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

/**
 * config
 * 애플리케이션 전체가 공유하는 런타임 설정 객체다.
 */
export const config = {
  env: process.env.NODE_ENV || "development",
  host: process.env.HOST || "127.0.0.1",
  port: parseInteger(process.env.PORT, 3001),
  cors: {
    allowedOrigins: parseOriginList(process.env.CORS_ORIGINS)
  },
  session: {
    cookieName: process.env.SESSION_COOKIE || "campuslens_session",
    ttlMs: parseInteger(process.env.SESSION_TTL_MS, DEFAULT_SESSION_TTL_MS)
  },
  ollama: {
    url: process.env.OLLAMA_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3.1"
  }
};

/**
 * isProduction
 * 현재 서버가 production 모드로 실행 중인지 확인한다.
 *
 * @returns {boolean} NODE_ENV가 production이면 true
 */
export function isProduction() {
  return config.env === "production";
}

/**
 * isAllowedOrigin
 * 요청 Origin이 현재 CORS 정책에서 허용되는지 판단한다.
 *
 * @param {string} origin - 요청 헤더의 Origin 값
 * @returns {boolean} 허용 가능한 Origin이면 true
 */
export function isAllowedOrigin(origin = "") {
  if (!origin) return false;
  if (config.cors.allowedOrigins.length === 0) {
    return !isProduction();
  }
  return config.cors.allowedOrigins.includes(origin);
}
