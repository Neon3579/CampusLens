import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { createId, readStore, updateStore } from "./jsonStore.js";

const SESSION_COOKIE = "campuslens_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function getRequestToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE] || "";
}

function setSessionCookie(res, token) {
  const cookieParts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];

  if (process.env.NODE_ENV === "production") {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

export function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt
  };
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedHash] = String(passwordHash).split(":");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;

  const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

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

export async function destroySession(req, res) {
  const token = getRequestToken(req);
  if (token) {
    const tokenHash = hashToken(token);
    await updateStore("sessions", sessions => sessions.filter(session => session.tokenHash !== tokenHash));
  }
  clearSessionCookie(res);
}

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
