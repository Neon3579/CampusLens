/**
 * File: server/routes/auth.js
 * Purpose: 회원가입, 로그인, 로그아웃, 현재 사용자 조회 API를 정의한다.
 * Notes: 사용자 생성과 세션 발급은 authService/jsonStore에 위임하고, 라우터는 HTTP 상태와 응답 포맷을 담당한다.
 */

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
import { validateSignupInput } from "../validators/authValidator.js";

const router = Router();

/**
 * POST /api/auth/signup
 * 새 사용자를 생성하고 즉시 로그인 세션을 발급한다.
 */
router.post("/signup", async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const validationError = validateSignupInput({ email, password, name });

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

/**
 * POST /api/auth/login
 * 이메일과 비밀번호를 검증한 뒤 새 세션 토큰을 발급한다.
 */
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

/**
 * POST /api/auth/logout
 * 현재 요청의 세션을 삭제하고 클라이언트 쿠키를 만료시킨다.
 */
router.post("/logout", async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * requireAuth가 채운 req.user를 공개 사용자 형태로 반환한다.
 */
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
