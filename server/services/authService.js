/**
 * File: server/services/authService.js
 * Purpose: 비밀번호 해시, 세션 토큰 발급/검증, 인증 미들웨어를 제공한다.
 * Notes: 실제 토큰은 클라이언트에만 전달하고 서버 저장소에는 SHA-256 해시만 보관한다.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { config, isProduction } from "../config.js";
import { createId, readStore, updateStore } from "./jsonStore.js";

const SESSION_COOKIE = config.session.cookieName;
const SESSION_TTL_MS = config.session.ttlMs;

/**
 * hashToken
 * 세션 원문 토큰을 저장소에 직접 보관하지 않기 위해 SHA-256 해시로 바꾼다.
 *
 * @param {string} token - 원문 세션 토큰
 * @returns {string} hex encoded 토큰 해시
 */
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * parseCookies
 * Cookie 헤더 문자열을 name/value 객체로 파싱한다.
 *
 * @param {string} cookieHeader - HTTP Cookie 헤더
 * @returns {Record<string, string>} 쿠키 맵
 */
function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

/**
 * getRequestToken
 * Authorization Bearer 헤더를 우선 사용하고 없으면 세션 쿠키에서 토큰을 찾는다.
 *
 * @param {import("express").Request} req - Express 요청 객체
 * @returns {string} 요청에서 추출한 원문 토큰
 */
function getRequestToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE] || "";
}

/**
 * setSessionCookie
 * 브라우저 기반 사용자를 위해 HttpOnly 세션 쿠키를 설정한다.
 *
 * @param {import("express").Response} res - Express 응답 객체
 * @param {string} token - 클라이언트에 전달할 원문 세션 토큰
 */
function setSessionCookie(res, token) {
  const cookieParts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];

  if (isProduction()) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
}

/**
 * clearSessionCookie
 * 로그아웃 시 브라우저의 세션 쿠키를 만료 처리한다.
 *
 * @param {import("express").Response} res - Express 응답 객체
 */
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

/**
 * normalizeEmail
 * 이메일 비교가 일관되도록 공백 제거와 소문자 변환을 수행한다.
 *
 * @param {string} email - 사용자 입력 이메일
 * @returns {string} 정규화된 이메일
 */
export function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

/**
 * publicUser
 * API 응답에 노출해도 되는 사용자 필드만 골라 반환한다.
 *
 * @param {object} user - 저장소 사용자 객체
 * @returns {object} 공개 사용자 객체
 */
export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt
  };
}

/**
 * hashPassword
 * scrypt와 사용자별 salt를 사용해 비밀번호 저장용 해시 문자열을 만든다.
 *
 * @param {string} password - 원문 비밀번호
 * @returns {string} algorithm:salt:hash 형식 문자열
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/**
 * verifyPassword
 * 입력 비밀번호와 저장된 scrypt 해시가 일치하는지 timingSafeEqual로 비교한다.
 *
 * @param {string} password - 입력 비밀번호
 * @param {string} passwordHash - 저장된 비밀번호 해시
 * @returns {boolean} 일치하면 true
 */
export function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedHash] = String(passwordHash).split(":");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;

  const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/**
 * createSession
 * 새 세션 토큰을 만들고 저장소에는 토큰 해시와 만료 시간을 저장한다.
 *
 * @param {string} userId - 세션 소유 사용자 id
 * @param {import("express").Request} req - Express 요청 객체
 * @param {import("express").Response} res - Express 응답 객체
 * @returns {Promise<{token: string, session: object}>} 원문 토큰과 저장된 세션 객체
 */
export async function createSession(userId, req, res) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const session = {
    id: createId("session"),
    userId,
    tokenHash: hashToken(token),
    userAgent: req.headers["user-agent"] || "",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString()
  };

  await updateStore("sessions", sessions => [...sessions, session]);
  setSessionCookie(res, token);

  return { token, session };
}

/**
 * destroySession
 * 현재 요청 토큰에 해당하는 서버 세션을 삭제하고 쿠키도 만료시킨다.
 *
 * @param {import("express").Request} req - Express 요청 객체
 * @param {import("express").Response} res - Express 응답 객체
 */
export async function destroySession(req, res) {
  const token = getRequestToken(req);
  if (token) {
    const tokenHash = hashToken(token);
    await updateStore("sessions", sessions => sessions.filter(session => session.tokenHash !== tokenHash));
  }
  clearSessionCookie(res);
}

/**
 * requireAuth
 * 보호 라우터에서 사용하는 인증 미들웨어다. 유효한 세션이면 req.user와 req.session을 채운다.
 *
 * @param {import("express").Request} req - Express 요청 객체
 * @param {import("express").Response} res - Express 응답 객체
 * @param {import("express").NextFunction} next - 다음 미들웨어
 */
export async function requireAuth(req, res, next) {
  try {
    const token = getRequestToken(req);
    if (!token) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "로그인이 필요합니다." });
      return;
    }

    const tokenHash = hashToken(token);
    const now = Date.now();
    const sessions = await readStore("sessions");
    const session = sessions.find(item => item.tokenHash === tokenHash && new Date(item.expiresAt).getTime() > now);

    if (!session) {
      res.status(401).json({ error: "INVALID_SESSION", message: "세션이 만료되었거나 유효하지 않습니다." });
      return;
    }

    const users = await readStore("users");
    const user = users.find(item => item.id === session.userId);

    if (!user) {
      res.status(401).json({ error: "USER_NOT_FOUND", message: "사용자를 찾을 수 없습니다." });
      return;
    }

    req.session = session;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
