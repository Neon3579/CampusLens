import { randomBytes } from "node:crypto";

import { SESSION_FILE, readJson, writeJson } from "./fileStore.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "campuslens_session";

let queue = Promise.resolve();

function withLock(fn) {
  const next = queue.catch(() => undefined).then(fn);
  queue = next.catch(() => undefined);
  return next;
}

async function readSessions() {
  return readJson(SESSION_FILE, []);
}

async function writeSessions(list) {
  return writeJson(SESSION_FILE, list);
}

function isExpired(session) {
  return new Date(session.expiresAt).getTime() <= Date.now();
}

export async function createSession(userId) {
  return withLock(async () => {
    const now = new Date();
    const session = {
      id: randomBytes(16).toString("hex"),
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    };
    const sessions = (await readSessions()).filter((s) => !isExpired(s));
    sessions.push(session);
    await writeSessions(sessions);
    return session;
  });
}

export async function findSession(sessionId) {
  if (!sessionId) return null;
  const sessions = await readSessions();
  const found = sessions.find((s) => s.id === sessionId);
  if (!found) return null;
  if (isExpired(found)) {
    await destroySession(sessionId);
    return null;
  }
  return found;
}

export async function destroySession(sessionId) {
  if (!sessionId) return;
  await withLock(async () => {
    const sessions = (await readSessions()).filter((s) => s.id !== sessionId && !isExpired(s));
    await writeSessions(sessions);
  });
}

export function parseCookies(header = "") {
  return String(header)
    .split(";")
    .reduce((acc, part) => {
      const [rawName, ...rest] = part.trim().split("=");
      if (!rawName) return acc;
      acc[rawName] = decodeURIComponent(rest.join("="));
      return acc;
    }, {});
}

export function readSessionIdFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE] || "";
}

export function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    ].join("; ")
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
}
