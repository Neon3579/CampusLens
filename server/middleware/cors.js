/**
 * File: server/middleware/cors.js
 * Purpose: 개발/운영 환경별 허용 Origin 정책에 따라 CORS 응답 헤더를 설정한다.
 * Notes: 인증 쿠키 사용 가능성을 고려해 허용된 origin에만 Access-Control-Allow-Credentials를 붙인다.
 */

import { isAllowedOrigin } from "../config.js";

/**
 * corsHandler
 * API 요청의 Origin을 검사하고 preflight OPTIONS 요청을 즉시 종료한다.
 *
 * @param {import("express").Request} req - Express 요청 객체
 * @param {import("express").Response} res - Express 응답 객체
 * @param {import("express").NextFunction} next - 다음 미들웨어
 */
export function corsHandler(req, res, next) {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}
