/**
 * File: server/middleware/errorHandlers.js
 * Purpose: API/정적 페이지 공통 404 처리와 서버 오류 JSON 응답 처리를 제공한다.
 * Notes: API 요청은 JSON 오류 포맷으로, 정적 페이지 요청은 간단한 텍스트 404로 구분한다.
 */

/**
 * notFoundHandler
 * 어떤 라우터에도 매칭되지 않은 요청을 API와 정적 페이지 기준으로 나누어 응답한다.
 *
 * @param {import("express").Request} req - Express 요청 객체
 * @param {import("express").Response} res - Express 응답 객체
 */
export function notFoundHandler(req, res) {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({
      error: "NOT_FOUND",
      message: "요청한 API를 찾을 수 없습니다."
    });
    return;
  }

  res.status(404).send("Not Found");
}

/**
 * errorHandler
 * 라우터/서비스에서 전달된 오류를 일관된 JSON 오류 응답으로 변환한다.
 *
 * @param {Error & {status?: number, code?: string}} err - 처리할 오류 객체
 * @param {import("express").Request} req - Express 요청 객체
 * @param {import("express").Response} res - Express 응답 객체
 * @param {import("express").NextFunction} next - Express 오류 미들웨어 시그니처 유지를 위한 next
 */
export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.code || "SERVER_ERROR",
    message: err.message || "서버 오류가 발생했습니다."
  });
}
