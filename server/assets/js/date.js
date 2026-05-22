/**
 * File: date.js
 * Purpose: 대시보드, 학식 날짜 이동, 시간표 주차 계산에서 공통으로 쓰는 날짜 유틸리티를 제공한다.
 * Notes: Date 객체는 호출부에서 수정될 수 있으므로 각 함수는 가능한 새 Date 객체를 만들어 반환한다.
 */

import { DOW_LABELS } from "./constants.js";

/**
 * startOfDay
 * 전달받은 날짜를 복제한 뒤 시각을 00:00:00.000으로 맞춘다.
 *
 * @param {Date|string|number} date - 기준 날짜
 * @returns {Date} 하루 시작 시각으로 정규화된 새 Date 객체
 */
export function startOfDay(date) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * mondayOf
 * 특정 날짜가 포함된 주의 월요일을 구한다. 일요일은 직전 월요일로 계산한다.
 *
 * @param {Date|string|number} date - 기준 날짜
 * @returns {Date} 해당 주의 월요일 00:00:00.000
 */
export function mondayOf(date) {
	const d = startOfDay(date);
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return d;
}

/**
 * addDays
 * 기준 날짜에서 n일만큼 이동한 새 Date 객체를 반환한다.
 *
 * @param {Date|string|number} date - 기준 날짜
 * @param {number} n - 이동할 일수. 음수면 과거로 이동한다.
 * @returns {Date} 이동된 날짜
 */
export function addDays(date, n) {
	const d = new Date(date);
	d.setDate(d.getDate() + n);
	return d;
}

/**
 * sameDay
 * 두 Date 객체가 같은 연, 월, 일을 가리키는지 확인한다.
 *
 * @param {Date} a - 비교할 첫 번째 날짜
 * @param {Date} b - 비교할 두 번째 날짜
 * @returns {boolean} 달력 날짜가 같으면 true
 */
export function sameDay(a, b) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/**
 * formatMD
 * 날짜를 공지/일정 카드에서 쓰는 MM.DD 형식으로 바꾼다.
 *
 * @param {Date|string|number} date - 표시할 날짜
 * @returns {string} MM.DD 형식 문자열 또는 파싱 실패 시 원본 문자열
 */
export function formatMD(date) {
	const d = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return String(date);
	return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * formatLongDate
 * 학식 날짜 네비게이션에 표시할 긴 날짜 라벨을 만든다.
 *
 * @param {Date} date - 표시할 날짜
 * @returns {string} 예: 5월 20일 (수)
 */
export function formatLongDate(date) {
	return `${date.getMonth() + 1}월 ${date.getDate()}일 (${DOW_LABELS[date.getDay()]})`;
}

/**
 * relativeDayLabel
 * 오늘과 비교해 선택 날짜가 오늘/내일/어제/며칠 전후인지 표시한다.
 *
 * @param {Date} date - 비교할 날짜
 * @returns {string} 상대 날짜 라벨
 */
export function relativeDayLabel(date) {
	const today = startOfDay(new Date());
	const diff = Math.round((startOfDay(date) - today) / (24 * 60 * 60 * 1000));
	if (diff === 0) return "오늘";
	if (diff === 1) return "내일";
	if (diff === -1) return "어제";
	return diff > 0 ? `${diff}일 후` : `${Math.abs(diff)}일 전`;
}
