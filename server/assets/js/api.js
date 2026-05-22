/**
 * File: api.js
 * Purpose: CampusLens 백엔드 API 호출을 일관된 방식으로 처리한다.
 * Notes: 모든 API 요청은 이 모듈을 통과해 인증 헤더, JSON 파싱, 오류 메시지 처리를 공유한다.
 */

import { API_BASE } from "./constants.js";
import { state } from "./state.js";

/**
 * apiFetch
 * fetch를 감싸 JSON 요청/응답, Bearer 토큰, 서버 오류 메시지 처리를 표준화한다.
 *
 * @param {string} path - 호출할 API path
 * @param {RequestInit} options - fetch 옵션
 * @returns {Promise<object|null>} 파싱된 JSON 응답
 * @throws {Error} HTTP 상태가 실패일 때 서버 메시지를 포함한 오류
 */
export async function apiFetch(path, options = {}) {
	const headers = {
		"Content-Type": "application/json",
		...(options.headers || {}),
	};

	if (state.token && !headers.Authorization) {
		headers.Authorization = `Bearer ${state.token}`;
	}

	const response = await fetch(`${API_BASE}${path}`, {
		credentials: "omit",
		...options,
		headers,
	});

	let data = null;
	try {
		data = await response.json();
	} catch (_) {
		data = null;
	}

	if (!response.ok) {
		const error = new Error((data && data.message) || `요청 실패 (${response.status})`);
		error.status = response.status;
		error.code = data && data.error;
		throw error;
	}

	return data;
}
