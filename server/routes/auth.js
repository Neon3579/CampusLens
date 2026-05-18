import { Router } from "express";

import {
  createSession,
  destroySession,
  hashPassword,
  normalizeEmail,
  publicUser,
  requireAuth,
  verifyPassword
} from "../services/authService.js";
import { createId, readStore, updateStore } from "../services/jsonStore.js";

const router = Router();

function validateSignup({ email, password, name }) {
  const normalizedEmail = normalizeEmail(email);
  const displayName = String(name || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "올바른 이메일을 입력하세요.";
  }

  if (String(password || "").length < 6) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }

  if (!displayName) {
    return "이름을 입력하세요.";
  }

  return "";
}

router.post("/signup", async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const validationError = validateSignup({ email, password, name });

    if (validationError) {
      res.status(400).json({ error: "INVALID_SIGNUP", message: validationError });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const users = await readStore("users");

    if (users.some(user => user.email === normalizedEmail)) {
      res.status(409).json({ error: "EMAIL_EXISTS", message: "이미 가입된 이메일입니다." });
      return;
    }

    const now = new Date().toISOString();
    const user = {
      id: createId("user"),
      email: normalizedEmail,
      name: String(name).trim(),
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now
    };

    await updateStore("users", currentUsers => [...currentUsers, user]);
    const { token } = await createSession(user.id, req, res);

    res.status(201).json({ user: publicUser(user), token });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const users = await readStore("users");
    const user = users.find(item => item.email === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "LOGIN_FAILED", message: "이메일 또는 비밀번호가 올바르지 않습니다." });
      return;
    }

    const { token } = await createSession(user.id, req, res);
    res.json({ user: publicUser(user), token });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
