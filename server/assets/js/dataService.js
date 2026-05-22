/**
 * File: dataService.js
 * Purpose: 인증, 공개 데이터, 개인 일정/시간표 API를 화면 상태로 변환한다.
 * Notes: 이 모듈은 API 응답을 정규화한 뒤 state.js의 상태만 갱신하고, 직접 DOM을 조작하지 않는다.
 */

import { CLASS_COLOR_POOL } from "./constants.js";
import { apiFetch } from "./api.js";
import { addClass, classes, setClasses, setRestaurants, setToken, state } from "./state.js";

/**
 * refreshSession
 * localStorage에 남아 있는 토큰으로 현재 로그인 세션을 확인한다.
 *
 * @returns {Promise<boolean>} 유효한 세션이면 true, 아니면 false
 */
export async function refreshSession() {
	if (!state.token) {
		state.user = null;
		return false;
	}

	try {
		const { user } = await apiFetch("/api/auth/me");
		state.user = user;
		return true;
	} catch (_) {
		state.user = null;
		setToken("");
		return false;
	}
}

/**
 * loginUser
 * 로그인 API를 호출하고 사용자 정보와 토큰을 앱 상태에 저장한다.
 *
 * @param {string} email - 로그인 이메일
 * @param {string} password - 로그인 비밀번호
 * @returns {Promise<object>} API 응답 데이터
 */
export async function loginUser(email, password) {
	const data = await apiFetch("/api/auth/login", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
	state.user = data.user;
	setToken(data.token);
	return data;
}

/**
 * signupUser
 * 회원가입 API를 호출하고 생성된 사용자 정보와 토큰을 앱 상태에 저장한다.
 *
 * @param {string} email - 가입 이메일
 * @param {string} password - 가입 비밀번호
 * @param {string} name - 사용자 표시 이름
 * @returns {Promise<object>} API 응답 데이터
 */
export async function signupUser(email, password, name) {
	const data = await apiFetch("/api/auth/signup", {
		method: "POST",
		body: JSON.stringify({ email, password, name }),
	});
	state.user = data.user;
	setToken(data.token);
	return data;
}

/**
 * logoutUser
 * 서버 세션을 삭제한 뒤 프론트엔드 인증 상태를 초기화한다.
 */
export async function logoutUser() {
	try {
		await apiFetch("/api/auth/logout", { method: "POST" });
	} catch (_) {
		// 로그아웃은 클라이언트 상태 정리가 더 중요하므로 서버 실패를 사용자 흐름으로 전파하지 않는다.
	}
	state.user = null;
	setToken("");
}

/**
 * normalizeNotice
 * 백엔드 또는 크롤링 결과의 공지 필드를 프론트엔드 렌더러가 기대하는 형태로 맞춘다.
 *
 * @param {object} notice - API에서 받은 원본 공지 객체
 * @returns {object} 화면 렌더링용 공지 객체
 */
function normalizeNotice(notice) {
	return {
		title: notice.title || "",
		category: notice.category || "공지",
		dept: notice.dept || "전체",
		deadline: notice.deadline || "",
		summary: notice.summary || "",
		content: notice.content || notice.body || "",
		url: notice.url || notice.link || notice.sourceUrl || "",
		image: notice.image || null,
		icon: notice.icon || null,
		tags: Array.isArray(notice.tags) ? notice.tags : [],
		urgent: Boolean(notice.urgent),
	};
}

/**
 * loadNotices
 * 공개 공지 API를 로드해 state.notices에 저장한다. 실패하면 빈 배열로 내려앉는다.
 */
export async function loadNotices() {
	try {
		const { notices } = await apiFetch("/api/public-data/notices");
		state.notices = Array.isArray(notices) ? notices.map(normalizeNotice) : [];
	} catch (error) {
		console.warn("공지 API 로드 실패", error);
		state.notices = [];
	}
}

/**
 * loadRestaurants
 * 공개 식당/학식 API를 로드해 공유 식당 상태에 저장한다.
 */
export async function loadRestaurants() {
	try {
		const { restaurants } = await apiFetch("/api/public-data/restaurants");
		setRestaurants(Array.isArray(restaurants) ? restaurants : []);
	} catch (error) {
		console.warn("학식 API 로드 실패", error);
		setRestaurants([]);
	}
}

/**
 * normalizeClass
 * 강의 객체에 화면 색상 클래스를 보강한다.
 *
 * @param {object} classItem - API에서 받은 강의 객체
 * @param {number} index - 강의 배열 내 순서
 * @returns {object} 화면 렌더링용 강의 객체
 */
function normalizeClass(classItem, index) {
	return {
		id: classItem.id,
		day: classItem.day,
		time: classItem.time,
		duration: classItem.duration,
		name: classItem.name,
		room: classItem.room || "",
		color: classItem.color || CLASS_COLOR_POOL[index % CLASS_COLOR_POOL.length],
	};
}

/**
 * loadClasses
 * 로그인 사용자는 개인 시간표를 우선 로드하고, 없거나 비로그인 상태면 공개 기본 시간표를 로드한다.
 */
export async function loadClasses() {
	if (state.user) {
		try {
			const { classes } = await apiFetch("/api/classes");
			if (Array.isArray(classes) && classes.length) {
				setClasses(classes.map(normalizeClass));
				return;
			}
		} catch (error) {
			console.warn("개인 시간표 API 로드 실패", error);
		}
	}

	try {
		const { classes } = await apiFetch("/api/public-data/classes");
		setClasses(Array.isArray(classes) ? classes.map(normalizeClass) : []);
	} catch (error) {
		console.warn("공통 시간표 API 로드 실패", error);
		setClasses([]);
	}
}

/**
 * createClass
 * 로그인 상태면 서버에 강의를 저장하고, 비로그인 상태면 현재 세션의 로컬 시간표에만 추가한다.
 *
 * @param {object} payload - 강의 생성 폼에서 만든 값
 * @returns {Promise<object>} 생성된 강의 객체
 */
export async function createClass(payload) {
	if (state.user) {
		const { class: created } = await apiFetch("/api/classes", {
			method: "POST",
			body: JSON.stringify(payload),
		});
		return created;
	}

	const localClass = {
		id: `local_${Date.now()}`,
		...payload,
		color: CLASS_COLOR_POOL[classes.length % CLASS_COLOR_POOL.length],
	};
	addClass(localClass);
	return localClass;
}

/**
 * loadTasks
 * 로그인 사용자의 개인 일정 목록을 로드한다. 비로그인 상태에서는 빈 배열을 사용한다.
 */
export async function loadTasks() {
	if (state.user) {
		try {
			const { tasks } = await apiFetch("/api/tasks");
			state.tasks = (tasks || []).map((task) => ({
				id: task.id,
				title: task.title,
				course: task.course || "",
				type: task.type || "과제",
				due: task.due,
				time: task.time || "",
			}));
			return;
		} catch (error) {
			console.warn("일정 API 로드 실패", error);
		}
	}
	state.tasks = [];
}

/**
 * createTask
 * 로그인 상태면 서버에 일정을 저장하고, 비로그인 상태면 현재 세션의 로컬 배열에만 추가한다.
 *
 * @param {object} payload - 일정 생성 폼에서 만든 값
 * @returns {Promise<object>} 생성된 일정 객체
 */
export async function createTask(payload) {
	if (state.user) {
		const { task } = await apiFetch("/api/tasks", {
			method: "POST",
			body: JSON.stringify(payload),
		});
		state.tasks.push({
			id: task.id,
			title: task.title,
			course: task.course || "",
			type: task.type || "과제",
			due: task.due,
			time: task.time || "",
		});
		return task;
	}

	const localTask = { id: `local_${Date.now()}`, ...payload };
	state.tasks.push(localTask);
	return localTask;
}
