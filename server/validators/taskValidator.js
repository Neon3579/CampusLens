/**
 * File: server/validators/taskValidator.js
 * Purpose: 개인 일정 생성/수정 API의 날짜, 시간, 필수 제목 규칙을 검증한다.
 * Notes: 부분 수정 PATCH에서는 전달된 필드만 검증할 수 있도록 partial 옵션을 지원한다.
 */

/**
 * isDateString
 * YYYY-MM-DD 형식 문자열이 실제 Date로 해석 가능한지 확인한다.
 *
 * @param {unknown} value - 검사할 날짜 값
 * @returns {boolean} 유효한 날짜 문자열이면 true
 */
export function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

/**
 * validateTaskInput
 * 일정 요청 본문을 검증하고 모든 오류 메시지를 배열로 반환한다.
 *
 * @param {object} body - 일정 생성/수정 요청 본문
 * @param {boolean} partial - PATCH처럼 일부 필드만 검사할지 여부
 * @returns {Array<string>} 검증 오류 메시지 목록
 */
export function validateTaskInput(body, partial = false) {
  const errors = [];

  if (!partial || body.title !== undefined) {
    if (!String(body.title || "").trim()) errors.push("제목을 입력하세요.");
  }

  if (!partial || body.due !== undefined) {
    if (!isDateString(body.due)) errors.push("마감일은 YYYY-MM-DD 형식이어야 합니다.");
  }

  if (body.time && !/^\d{2}:\d{2}$/.test(String(body.time))) {
    errors.push("시간은 HH:mm 형식이어야 합니다.");
  }

  return errors;
}
