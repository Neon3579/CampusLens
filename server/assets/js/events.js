/**
 * File: events.js
 * Purpose: 사용자 입력, 클릭, 키보드, 폼 제출 이벤트를 상태 변경과 렌더링 함수에 연결한다.
 * Notes: 이벤트 등록을 한 파일에 모아 HTML 컴포넌트와 렌더러가 직접 비즈니스 흐름을 알지 않도록 한다.
 */

import { HASH_PAGES } from "./constants.js";
import { addDays, mondayOf, startOfDay } from "./date.js";
import { $id, switchPage, toast } from "./dom.js";
import {
	createClass,
	createTask,
	loadClasses,
	loadTasks,
	loginUser,
	logoutUser,
	signupUser,
} from "./dataService.js";
import {
	renderAuthUI,
	renderChips,
	renderRestaurants,
	renderStats,
	renderTasks,
	renderTimeTable,
	renderNotices,
} from "./renderers.js";
import { state } from "./state.js";
import {
	closeAllModals,
	closeAuthModal,
	closeClassModal,
	closeNoticeDetail,
	closeTaskModal,
	openAuthModal,
	openClassModal,
	openNoticeDetail,
	openTaskModal,
	setAuthMsg,
	setAuthTab,
} from "./ui.js";

/**
 * applyHash
 * 현재 location.hash가 가리키는 앱 페이지가 있으면 해당 페이지로 이동한다.
 */
function applyHash() {
	const hashPage = location.hash.replace(/^#/, "");
	if (HASH_PAGES.has(hashPage)) switchPage(hashPage);
}

/**
 * refreshAfterAuthChange
 * 로그인/로그아웃 뒤 개인 데이터와 기본 시간표를 다시 로드하고 핵심 화면을 갱신한다.
 */
async function refreshAfterAuthChange() {
	await Promise.all([loadTasks(), loadClasses()]);
	renderAuthUI();
	renderStats();
	renderTimeTable();
	renderTasks();
}

/**
 * handlePageNavigation
 * 상단 내비게이션 버튼 클릭을 앱 페이지 전환으로 연결한다.
 *
 * @param {MouseEvent} event - 클릭 이벤트
 */
function handlePageNavigation(event) {
	const button = event.currentTarget;
	switchPage(button.dataset.page);
}

/**
 * handleSearchInput
 * 공지 검색어 상태를 갱신하고 공지 목록을 다시 렌더링한다.
 *
 * @param {InputEvent} event - 검색 input 이벤트
 */
function handleSearchInput(event) {
	state.query = event.target.value;
	renderNotices();
}

/**
 * handleDocumentClick
 * 동적으로 렌더링되는 칩, 공지 카드, 헤더 버튼, CTA 버튼의 클릭을 이벤트 위임으로 처리한다.
 *
 * @param {MouseEvent} event - 문서 클릭 이벤트
 */
async function handleDocumentClick(event) {
	const target = event.target instanceof Element ? event.target : event.target.parentElement;
	if (!target) return;

	const chip = target.closest(".chip[data-cat]");
	if (chip) {
		state.filter = chip.dataset.cat;
		renderChips();
		renderNotices();
		return;
	}

	const loginButton = target.closest("#loginBtn, #taskLoginCta");
	if (loginButton) {
		openAuthModal("login");
		return;
	}

	const logoutButton = target.closest("#logoutBtn");
	if (logoutButton) {
		await logoutUser();
		await refreshAfterAuthChange();
		toast("로그아웃되었습니다.");
		return;
	}

	const authTab = target.closest(".modal-tabs button[data-auth-tab]");
	if (authTab) {
		setAuthTab(authTab.dataset.authTab);
		return;
	}

	const noticeCard = target.closest("[data-notice-index]");
	if (noticeCard && !target.closest("a")) {
		const index = Number(noticeCard.dataset.noticeIndex);
		if (!Number.isNaN(index)) openNoticeDetail(index);
	}
}

/**
 * handleNoticeKeydown
 * 키보드 사용자도 공지 카드를 Enter 또는 Space로 열 수 있게 한다.
 *
 * @param {KeyboardEvent} event - 키보드 이벤트
 */
function handleNoticeKeydown(event) {
	const target = event.target instanceof Element ? event.target : event.target.parentElement;
	const noticeCard = target?.closest("[data-notice-index]");
	if (!noticeCard || (event.key !== "Enter" && event.key !== " ")) return;

	event.preventDefault();
	const index = Number(noticeCard.dataset.noticeIndex);
	if (!Number.isNaN(index)) openNoticeDetail(index);
}

/**
 * handleEscapeKey
 * Escape 키를 누르면 열려 있는 모달을 모두 닫는다.
 *
 * @param {KeyboardEvent} event - 키보드 이벤트
 */
function handleEscapeKey(event) {
	if (event.key === "Escape") closeAllModals();
}

/**
 * handleTaskSubmit
 * 일정 추가 폼을 서버 또는 로컬 상태에 저장하고 관련 화면을 갱신한다.
 *
 * @param {SubmitEvent} event - 폼 제출 이벤트
 */
async function handleTaskSubmit(event) {
	event.preventDefault();
	const form = new FormData(event.currentTarget);
	const payload = {
		title: (form.get("title") || "").trim(),
		course: (form.get("course") || "").trim(),
		type: form.get("type") || "과제",
		due: form.get("due"),
		time: form.get("time") || "",
	};

	try {
		await createTask(payload);
		if (state.user) await loadTasks();
		closeTaskModal();
		renderStats();
		renderTimeTable();
		renderTasks();
		toast(state.user ? "일정이 서버에 저장되었습니다." : "일정이 추가되었습니다 (로컬).");
	} catch (error) {
		toast(error.message || "일정 추가 실패");
	}
}

/**
 * handleClassSubmit
 * 강의 추가 폼을 서버 또는 로컬 상태에 저장하고 시간표를 갱신한다.
 *
 * @param {SubmitEvent} event - 폼 제출 이벤트
 */
async function handleClassSubmit(event) {
	event.preventDefault();
	const form = new FormData(event.currentTarget);
	const payload = {
		name: (form.get("name") || "").trim(),
		room: (form.get("room") || "").trim(),
		day: form.get("day") || "월",
		time: form.get("time") || "09:00",
		duration: Number(form.get("duration") || 2),
	};

	try {
		await createClass(payload);
		if (state.user) await loadClasses();
		closeClassModal();
		renderStats();
		renderTimeTable();
		toast(state.user ? "강의가 시간표에 추가되었습니다." : "강의가 추가되었습니다 (로컬).");
	} catch (error) {
		toast(error.message || "강의 추가 실패");
	}
}

/**
 * handleAuthSubmit
 * 로그인/회원가입 폼 제출을 현재 탭 상태에 맞춰 처리한다.
 *
 * @param {SubmitEvent} event - 폼 제출 이벤트
 */
async function handleAuthSubmit(event) {
	event.preventDefault();
	const form = new FormData(event.currentTarget);
	const email = (form.get("email") || "").trim();
	const password = form.get("password") || "";
	const name = (form.get("name") || "").trim();

	try {
		setAuthMsg("");
		if (state.authTab === "login") {
			await loginUser(email, password);
		} else {
			if (!name) {
				setAuthMsg("이름을 입력해주세요.");
				return;
			}
			await signupUser(email, password, name);
		}

		closeAuthModal();
		await refreshAfterAuthChange();
		toast(`${state.user.name || state.user.email}님, 환영합니다.`);
	} catch (error) {
		setAuthMsg(error.message || "요청 실패");
	}
}

/**
 * setupWeekControls
 * 시간표 주차 이동 버튼의 클릭 이벤트를 등록한다.
 */
function setupWeekControls() {
	$id("prevWeekBtn")?.addEventListener("click", () => {
		state.weekStart = addDays(state.weekStart, -7);
		renderTimeTable();
		renderTasks();
	});

	$id("nextWeekBtn")?.addEventListener("click", () => {
		state.weekStart = addDays(state.weekStart, 7);
		renderTimeTable();
		renderTasks();
	});

	$id("todayBtn")?.addEventListener("click", () => {
		state.weekStart = mondayOf(new Date());
		renderTimeTable();
		renderTasks();
	});
}

/**
 * setupMealDateControls
 * 학식 날짜 이동 버튼의 클릭 이벤트를 등록한다.
 */
function setupMealDateControls() {
	$id("prevMealDateBtn")?.addEventListener("click", () => {
		state.mealDate = addDays(state.mealDate, -1);
		renderRestaurants();
	});

	$id("nextMealDateBtn")?.addEventListener("click", () => {
		state.mealDate = addDays(state.mealDate, 1);
		renderRestaurants();
	});

	$id("todayMealBtn")?.addEventListener("click", () => {
		state.mealDate = startOfDay(new Date());
		renderRestaurants();
	});
}

/**
 * setupModalControls
 * 모달 열기/닫기 버튼과 오버레이 클릭 닫기 동작을 등록한다.
 */
function setupModalControls() {
	$id("openTaskModalBtn")?.addEventListener("click", openTaskModal);
	$id("modalCloseBtn")?.addEventListener("click", closeTaskModal);
	$id("modalCancelBtn")?.addEventListener("click", closeTaskModal);
	$id("taskModal")?.addEventListener("click", (event) => {
		if (event.target === event.currentTarget) closeTaskModal();
	});

	$id("openClassModalBtn")?.addEventListener("click", openClassModal);
	$id("classCloseBtn")?.addEventListener("click", closeClassModal);
	$id("classCancelBtn")?.addEventListener("click", closeClassModal);
	$id("classModal")?.addEventListener("click", (event) => {
		if (event.target === event.currentTarget) closeClassModal();
	});

	$id("authCloseBtn")?.addEventListener("click", closeAuthModal);
	$id("authCancelBtn")?.addEventListener("click", closeAuthModal);
	$id("authModal")?.addEventListener("click", (event) => {
		if (event.target === event.currentTarget) closeAuthModal();
	});

	$id("noticeDetailCloseBtn")?.addEventListener("click", closeNoticeDetail);
	$id("noticeDetailModal")?.addEventListener("click", (event) => {
		if (event.target === event.currentTarget) closeNoticeDetail();
	});
}

/**
 * setupEvents
 * 앱 시작 시 한 번만 호출되어 모든 정적/동적 UI 이벤트를 등록한다.
 */
export function setupEvents() {
	document.querySelectorAll(".nav-bar button").forEach((button) => {
		button.addEventListener("click", handlePageNavigation);
	});

	applyHash();
	window.addEventListener("hashchange", applyHash);

	$id("searchInput")?.addEventListener("input", handleSearchInput);
	document.addEventListener("click", handleDocumentClick);
	document.addEventListener("keydown", handleNoticeKeydown);
	document.addEventListener("keydown", handleEscapeKey);

	setupWeekControls();
	setupMealDateControls();
	setupModalControls();

	$id("taskForm")?.addEventListener("submit", handleTaskSubmit);
	$id("classForm")?.addEventListener("submit", handleClassSubmit);
	$id("authForm")?.addEventListener("submit", handleAuthSubmit);
}
