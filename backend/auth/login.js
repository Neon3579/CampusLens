import {
  findUserByEmail,
  publicUser,
  verifyPassword,
} from "../services/userStore.js";
import { createSession, setSessionCookie } from "../services/sessionStore.js";

export default async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(String(password || ""), user.passwordHash)) {
      res.status(401).json({ error: "LOGIN_FAILED", message: "이메일 또는 비밀번호가 올바르지 않습니다." });
      return;
    }
    const session = await createSession(user.id);
    setSessionCookie(res, session.id);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
