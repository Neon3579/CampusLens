/**
 * File: server/validators/authValidator.js
 * Purpose: 회원가입 요청의 이메일, 비밀번호, 이름 필드를 검증한다.
 * Notes: 로그인 검증은 인증 실패 메시지를 단순화해야 하므로 라우터에서 직접 처리한다.
 */

import { normalizeEmail } from "../services/authService.js";

/**
 * validateSignupInput
 * 회원가입 요청 본문이 최소 가입 조건을 만족하는지 확인하고 첫 번째 오류 메시지를 반환한다.
 *
 * @param {object} input - 회원가입 입력값
 * @param {string} input.email - 사용자 이메일
 * @param {string} input.password - 사용자 비밀번호
 * @param {string} input.name - 사용자 표시 이름
 * @returns {string} 오류 메시지. 유효하면 빈 문자열
 */
export function validateSignupInput({ email, password, name }) {
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
