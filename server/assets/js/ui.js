/**
 * File: ui.js
 * Purpose: 모달, 인증 탭, 공지 상세 보기처럼 특정 UI 상태를 직접 조작하는 함수를 제공한다.
 * Notes: 목록 렌더링은 renderers.js가 맡고, 이 파일은 사용자의 즉시 동작에 따른 작은 UI 전환에 집중한다.
 */

import { badgeTemplate, escapeHtml, safeBackground, tagListTemplate } from "./components.js";
import { $id, toast } from "./dom.js";
import { state } from "./state.js";

/**
 * openClassModal
 * 강의 추가 폼을 초기화하고 강의 모달을 연다.
 */
export function openClassModal() {
	const form = $id("classForm");
	if (form) form.reset();
	$id("classModal")?.classList.add("show");
}

/**
 * closeClassModal
 * 강의 추가 모달을 닫는다.
 */
export function closeClassModal() {
	$id("classModal")?.classList.remove("show");
}

/**
 * openTaskModal
 * 일정 추가 모달을 열고 첫 입력 필드에 포커스를 준다.
 */
export function openTaskModal() {
	if (!state.user) {
		toast("로그인하면 일정이 서버에 저장됩니다.");
	}

	$id("taskModal")?.classList.add("show");
	setTimeout(() => $id("taskForm")?.querySelector("input[name='title']")?.focus(), 50);
}

/**
 * closeTaskModal
 * 일정 추가 모달을 닫고 폼 값을 초기화한다.
 */
export function closeTaskModal() {
	$id("taskModal")?.classList.remove("show");
	$id("taskForm")?.reset();
}

/**
 * setAuthTab
 * 로그인/회원가입 탭 상태와 폼 필드 표시 상태를 동기화한다.
 *
 * @param {"login"|"signup"} tab - 활성화할 인증 탭
 */
export function setAuthTab(tab) {
	state.authTab = tab;
	document
		.querySelectorAll(".modal-tabs button[data-auth-tab]")
		.forEach((btn) => btn.classList.toggle("active", btn.dataset.authTab === tab));

	const title = $id("authModalTitle");
	if (title) title.textContent = tab === "login" ? "로그인" : "회원가입";

	const submit = $id("authSubmitBtn");
	if (submit) submit.textContent = tab === "login" ? "로그인" : "가입하기";

	document
		.querySelectorAll('#authForm [data-only="signup"]')
		.forEach((el) => {
			el.classList.toggle("auth-only-signup", tab !== "signup");
		});

	const nameInput = document.querySelector('#authForm input[name="name"]');
	if (nameInput) nameInput.required = tab === "signup";

	const passwordInput = document.querySelector('#authForm input[name="password"]');
	if (passwordInput) {
		passwordInput.setAttribute("autocomplete", tab === "login" ? "current-password" : "new-password");
	}

	setAuthMsg("");
}

/**
 * openAuthModal
 * 인증 탭을 지정한 뒤 인증 모달을 열고 이메일 입력 필드에 포커스를 준다.
 *
 * @param {"login"|"signup"} tab - 처음 보여 줄 인증 탭
 */
export function openAuthModal(tab = "login") {
	setAuthTab(tab);
	$id("authModal")?.classList.add("show");
	setTimeout(() => $id("authForm")?.querySelector("input[name='email']")?.focus(), 50);
}

/**
 * closeAuthModal
 * 인증 모달을 닫고 폼과 메시지 상태를 초기화한다.
 */
export function closeAuthModal() {
	$id("authModal")?.classList.remove("show");
	$id("authForm")?.reset();
	setAuthMsg("");
}

/**
 * setAuthMsg
 * 인증 모달 내부의 오류 또는 안내 메시지를 표시한다.
 *
 * @param {string} message - 표시할 메시지
 * @param {"error"|"info"} type - 메시지 종류
 */
export function setAuthMsg(message, type = "error") {
	const target = $id("authMsg");
	if (!target) return;

	if (!message) {
		target.classList.remove("show", "info");
		target.textContent = "";
		return;
	}

	target.textContent = message;
	target.classList.toggle("info", type === "info");
	target.classList.add("show");
}

/**
 * openNoticeDetail
 * 선택된 공지의 상세 모달을 데이터 기반으로 채운 뒤 연다.
 *
 * @param {number} index - state.notices 배열의 공지 인덱스
 */
export function openNoticeDetail(index) {
	const notice = state.notices[index];
	if (!notice) return;

	const modal = $id("noticeDetailModal");
	const thumb = $id("noticeDetailThumb");
	const background = safeBackground(notice.image);

	if (thumb) {
		if (background) {
			thumb.style.background = background;
			thumb.innerHTML = `<span>${escapeHtml(notice.icon || "")}</span>`;
		} else {
			thumb.style.background = "";
			thumb.innerHTML = "";
		}
	}

	const meta = $id("noticeDetailMeta");
	if (meta) {
		meta.innerHTML =
			badgeTemplate(notice.category, notice.urgent ? "warn" : "") +
			badgeTemplate(notice.dept, "gray");
	}

	const title = $id("noticeDetailTitle");
	if (title) title.textContent = notice.title || "";

	const deadline = $id("noticeDetailDeadline");
	if (deadline) {
		if (notice.deadline) {
			deadline.textContent = `마감 ${notice.deadline}`;
			deadline.className = notice.urgent ? "deadline-pill warn" : "deadline-pill";
			deadline.style.display = "";
		} else {
			deadline.style.display = "none";
		}
	}

	const content = $id("noticeDetailContent");
	if (content) content.textContent = notice.content || notice.summary || "";

	const tags = $id("noticeDetailTags");
	if (tags) tags.innerHTML = tagListTemplate(notice.tags || []);

	const link = $id("noticeDetailLink");
	if (link) {
		if (notice.url) {
			link.href = notice.url;
			link.hidden = false;
		} else {
			link.hidden = true;
			link.removeAttribute("href");
		}
	}

	modal?.classList.add("show");
}

/**
 * closeNoticeDetail
 * 공지 상세 모달을 닫는다.
 */
export function closeNoticeDetail() {
	$id("noticeDetailModal")?.classList.remove("show");
}

/**
 * closeAllModals
 * Escape 키 처리를 위해 열려 있는 모든 모달을 닫는다.
 */
export function closeAllModals() {
	if ($id("taskModal")?.classList.contains("show")) closeTaskModal();
	if ($id("classModal")?.classList.contains("show")) closeClassModal();
	if ($id("authModal")?.classList.contains("show")) closeAuthModal();
	if ($id("noticeDetailModal")?.classList.contains("show")) closeNoticeDetail();
}
