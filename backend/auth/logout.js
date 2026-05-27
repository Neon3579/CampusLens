import {
  clearSessionCookie,
  destroySession,
  readSessionIdFromRequest,
} from "../services/sessionStore.js";

export default async function logout(req, res, next) {
  try {
    const sessionId = readSessionIdFromRequest(req);
    await destroySession(sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
