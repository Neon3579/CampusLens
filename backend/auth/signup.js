import {
  createUser,
  findUserByEmail,
  normalizeEmail,
  publicUser,
} from "../services/userStore.js";
import { createSession, setSessionCookie } from "../services/sessionStore.js";

function validate({ email, password, name }) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return "올바른 이메일을 입력하세요.";
  if (String(password || "").length < 6) return "비밀번호는 6자 이상이어야 합니다.";
  if (!String(name || "").trim()) return "이름을 입력하세요.";
  return "";
}

export default async function signup(req, res, next) {
  try {
    const { email, password, name } = req.body || {};
    const error = validate({ email, password, name });
    if (error) {
      res.status(400).json({ error: "INVALID_SIGNUP", message: error });
      return;
    }
    if (await findUserByEmail(email)) {
      res.status(409).json({ error: "EMAIL_EXISTS", message: "이미 가입된 이메일입니다." });
      return;
    }
    const user = await createUser({ email, password, name });
    const session = await createSession(user.id);
    setSessionCookie(res, session.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
