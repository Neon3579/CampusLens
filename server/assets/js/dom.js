/**
 * File: dom.js
 * Purpose: DOM 조회, 토스트 표시, 페이지 전환처럼 여러 모듈에서 반복되는 UI 보조 작업을 제공한다.
 * Notes: 이 파일은 데이터 로딩을 직접 수행하지 않고 화면 요소 조작에만 집중한다.
 */

import { state } from "./state.js";

/**
 * $id
 * id 기반 DOM 조회를 짧고 명확하게 쓰기 위한 헬퍼다.
 *
 * @param {string} id - 조회할 요소 id
 * @returns {HTMLElement|null} 해당 id의 DOM 요소
 */
export function $id(id) {
	return document.getElementById(id);
}

/**
 * toast
 * 화면 하단의 토스트 메시지를 표시하고 일정 시간 뒤 자동으로 숨긴다.
 *
 * @param {string} message - 사용자에게 보여 줄 메시지
 */
export function toast(message) {
	const target = $id("toast");
	if (!target) return;

	target.textContent = message;
	target.classList.add("show");
	clearTimeout(toast.timer);
	toast.timer = setTimeout(() => target.classList.remove("show"), 2200);
}

/**
 * switchPage
 * SPA 내부 페이지를 전환하고 내비게이션 활성 상태를 갱신한다.
 *
 * @param {string} page - dashboard, notices, meals, schedule 중 하나
 */
export function switchPage(page) {
	const targetPage = $id(`page-${page}`);
	if (!targetPage) return;

	state.page = page;
	document
		.querySelectorAll(".app-page")
		.forEach((section) => section.classList.remove("active"));
	targetPage.classList.add("active");
	document
		.querySelectorAll(".nav-bar button")
		.forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));
}
