/**
 * File: server/validators/classValidator.js
 * Purpose: 개인 시간표 강의 생성 API의 요일, 시작 시간, 강의 시간 규칙을 검증한다.
 * Notes: 현재 UI는 월~금 시간표만 제공하므로 VALID_DAYS도 평일로 제한한다.
 */

export const VALID_DAYS = ["월", "화", "수", "목", "금"];

/**
 * isTimeString
 * HH:mm 형식의 시간 문자열인지 확인한다.
 *
 * @param {unknown} value - 검사할 시간 값
 * @returns {boolean} 형식이 맞으면 true
 */
export function isTimeString(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

/**
 * validateClassInput
 * 강의 요청 본문을 검증하고 모든 오류 메시지를 배열로 반환한다.
 *
 * @param {object} body - 강의 생성/수정 요청 본문
 * @param {boolean} partial - 일부 필드만 검사할지 여부
 * @returns {Array<string>} 검증 오류 메시지 목록
 */
export function validateClassInput(body, partial = false) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    if (!String(body.name || "").trim()) errors.push("과목명을 입력하세요.");
  }

  if (!partial || body.day !== undefined) {
    if (!VALID_DAYS.includes(String(body.day || ""))) {
      errors.push("요일은 월/화/수/목/금 중 하나여야 합니다.");
    }
  }

  if (!partial || body.time !== undefined) {
    if (!isTimeString(body.time)) errors.push("시작 시간은 HH:mm 형식이어야 합니다.");
  }

  if (!partial || body.duration !== undefined) {
    const n = Number(body.duration);
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      errors.push("강의 시간은 1~6 사이의 정수여야 합니다.");
    }
  }

  return errors;
}
