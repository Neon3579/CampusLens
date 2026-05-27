import { findSession, readSessionIdFromRequest } from "../services/sessionStore.js";
import { findUserById } from "../services/userStore.js";

export async function requireAuth(req, res, next) {
  try {
    const sessionId = readSessionIdFromRequest(req);
    if (!sessionId) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "로그인이 필요합니다." });
      return;
    }
    const session = await findSession(sessionId);
    if (!session) {
      res.status(401).json({ error: "INVALID_SESSION", message: "세션이 만료되었거나 유효하지 않습니다." });
      return;
    }
    const user = await findUserById(session.userId);
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
