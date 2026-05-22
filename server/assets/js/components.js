/**
 * File: components.js
 * Purpose: 화면에 삽입되는 반복 HTML 조각을 작은 컴포넌트 함수로 분리한다.
 * Notes: 외부 API/LLM/크롤링 데이터가 섞일 수 있으므로 텍스트는 escapeHtml을 거친 뒤 문자열 템플릿에 넣는다.
 */

import { TYPE_TO_MEAL_CLASS } from "./constants.js";

const HTML_ESCAPE_MAP = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#039;",
};

/**
 * escapeHtml
 * 사용자 입력 또는 외부 데이터가 HTML로 해석되지 않도록 특수 문자를 엔티티로 바꾼다.
 *
 * @param {unknown} value - HTML 템플릿에 넣을 값
 * @returns {string} 이스케이프된 문자열
 */
export function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * safeBackground
 * 공지 썸네일 배경에 허용할 CSS 값만 통과시킨다.
 *
 * @param {unknown} value - API에서 온 배경 값
 * @returns {string} 허용된 배경 값 또는 빈 문자열
 */
export function safeBackground(value) {
	const raw = String(value || "").trim();
	const safeGradient = /^(linear-gradient|radial-gradient)\([^<>";]+\)$/i.test(raw);
	const safeColor = /^(#[0-9a-f]{3,8}|rgb\([0-9,\s.]+\)|rgba\([0-9,\s.]+\))$/i.test(raw);
	return safeGradient || safeColor ? raw : "";
}

/**
 * tagListTemplate
 * 공지 태그 배열을 배지 목록 HTML로 렌더링한다.
 *
 * @param {Array<string>} tags - 태그 문자열 배열
 * @returns {string} 태그 배지 HTML
 */
export function tagListTemplate(tags = []) {
	return tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
}

/**
 * badgeTemplate
 * 공통 메타 배지를 렌더링한다.
 *
 * @param {string} label - 배지 텍스트
 * @param {string} className - 추가 배지 클래스
 * @returns {string} 배지 HTML
 */
export function badgeTemplate(label, className = "") {
	return `<span class="badge ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
}

/**
 * statCardTemplate
 * 대시보드 상단의 숫자 통계 카드를 렌더링한다.
 *
 * @param {[string, number|string, string]} stat - 라벨, 숫자, 설명으로 구성된 튜플
 * @returns {string} 통계 카드 HTML
 */
export function statCardTemplate(stat) {
	return `
		<article class="card stat-card" data-component="stat-card">
			<small>${escapeHtml(stat[0])}</small>
			<strong>${escapeHtml(stat[1])}</strong>
			<span>${escapeHtml(stat[2])}</span>
		</article>`;
}

/**
 * chipTemplate
 * 공지 카테고리 필터 칩을 렌더링한다.
 *
 * @param {string} category - 카테고리명
 * @param {boolean} active - 현재 선택된 카테고리인지 여부
 * @returns {string} 필터 칩 HTML
 */
export function chipTemplate(category, active) {
	return `<button class="chip ${active ? "active" : ""}" data-cat="${escapeHtml(category)}">${escapeHtml(category)}</button>`;
}

/**
 * noticeCardTemplate
 * 공지 목록 화면의 카드형 공지 컴포넌트를 렌더링한다.
 *
 * @param {object} notice - 화면 표시용 공지 객체
 * @param {number} originIndex - 원본 state.notices 배열의 인덱스
 * @returns {string} 공지 카드 HTML
 */
export function noticeCardTemplate(notice, originIndex) {
	const background = safeBackground(notice.image);
	const hasImage = Boolean(background);
	const cardClass = `notice-card ${hasImage ? "" : "no-thumb"} ${!hasImage && notice.urgent ? "urgent" : ""}`.trim();
	const thumb = hasImage
		? `<div class="notice-thumb" style="background:${background}"><span>${escapeHtml(notice.icon || "")}</span></div>`
		: "";
	const deadlineClass = notice.urgent ? "deadline-pill warn" : "deadline-pill";
	const deadline = notice.deadline
		? `<span class="${deadlineClass}">마감 ${escapeHtml(notice.deadline)}</span>`
		: "";

	return `
		<article class="${cardClass}" data-component="notice-card" data-notice-index="${originIndex}" tabindex="0" role="button">
			${thumb}
			<div class="notice-body-area">
				<div class="meta">
					${badgeTemplate(notice.category, notice.urgent ? "warn" : "")}
					${badgeTemplate(notice.dept, "gray")}
				</div>
				<h4>${escapeHtml(notice.title)}</h4>
				<p>${escapeHtml(notice.summary)}</p>
				<div class="notice-foot">
					<div class="tags">${tagListTemplate(notice.tags)}</div>
					${deadline}
				</div>
			</div>
		</article>`;
}

/**
 * urgentNoticeTemplate
 * 대시보드의 마감 임박 공지 행을 렌더링한다.
 *
 * @param {object} notice - 화면 표시용 공지 객체
 * @param {number} originIndex - 원본 state.notices 배열의 인덱스
 * @returns {string} 임박 공지 HTML
 */
export function urgentNoticeTemplate(notice, originIndex) {
	return `
		<article class="notice" data-component="urgent-notice" data-notice-index="${originIndex}" tabindex="0" role="button">
			<div class="notice-main">
				<div>
					<div class="meta">
						${badgeTemplate(notice.category, "warn")}
						${badgeTemplate(notice.dept, "gray")}
					</div>
					<h4>${escapeHtml(notice.title)}</h4>
					<p>${escapeHtml(notice.summary)}</p>
				</div>
				<div class="deadline">
					<small>마감</small>
					<strong>${escapeHtml(notice.deadline || "-")}</strong>
				</div>
			</div>
		</article>`;
}

/**
 * restaurantPanelTemplate
 * 식당 하나와 선택 날짜의 식단 행들을 묶어 렌더링한다.
 *
 * @param {object} restaurant - 식당 정보
 * @param {Array<object>} meals - 선택 날짜에 해당하는 식단 배열
 * @returns {string} 식당 패널 HTML
 */
export function restaurantPanelTemplate(restaurant, meals) {
	const mealsHtml = meals.length
		? meals.map(mealRowTemplate).join("")
		: `<div class="empty meal-empty">선택한 날짜는 운영하지 않습니다.</div>`;

	return `
		<section class="restaurant-panel" data-component="restaurant-panel">
			<header class="restaurant-head ${escapeHtml(restaurant.gradient || "")}">
				<div class="restaurant-icon">${escapeHtml(restaurant.icon || "")}</div>
				<div>
					<h4>${escapeHtml(restaurant.name)}</h4>
					<p>${escapeHtml(restaurant.desc)}</p>
				</div>
			</header>
			<div class="restaurant-meals">${mealsHtml}</div>
		</section>`;
}

/**
 * mealRowTemplate
 * 식당 패널 안의 식사 한 끼를 렌더링한다.
 *
 * @param {object} meal - 식사 유형, 메뉴, 설명, 제공 시간
 * @returns {string} 식단 행 HTML
 */
export function mealRowTemplate(meal) {
	const typeClass = TYPE_TO_MEAL_CLASS[meal.type] || "";
	return `
		<article class="meal-row" data-component="meal-row">
			<span class="meal-type ${typeClass}">${escapeHtml(meal.type)}</span>
			<div class="meal-info">
				<strong>${escapeHtml(meal.menu)}</strong>
				<p>${escapeHtml(meal.desc)}</p>
			</div>
			<span class="meal-time">${escapeHtml(meal.time)}</span>
		</article>`;
}

/**
 * todayMealTemplate
 * 대시보드의 오늘 점심 요약 행을 렌더링한다.
 *
 * @param {object} item - 식당명과 식사 객체를 포함한 요약 데이터
 * @returns {string} 오늘 학식 요약 HTML
 */
export function todayMealTemplate(item) {
	return `
		<article class="task" data-component="today-meal">
			<span class="badge green">점심</span>
			<strong class="task-title">${escapeHtml(item.place)} · ${escapeHtml(item.meal.menu)}</strong>
			<p>${escapeHtml(item.meal.desc)} · ${escapeHtml(item.meal.time)}</p>
		</article>`;
}

/**
 * taskCardTemplate
 * 일정 목록과 다가오는 일정 영역에서 공통으로 쓰는 일정 카드다.
 *
 * @param {object} task - 일정 객체
 * @param {string} formattedDue - 화면에 표시할 마감 날짜
 * @returns {string} 일정 카드 HTML
 */
export function taskCardTemplate(task, formattedDue) {
	const course = task.course ? `${task.course} · ` : "";
	const time = task.time ? ` ${task.time}` : "";
	return `
		<article class="task" data-component="task-card">
			<span class="badge">${escapeHtml(task.type)}</span>
			<strong class="task-title">${escapeHtml(task.title)}</strong>
			<p>${escapeHtml(course)}마감 ${escapeHtml(formattedDue)}${escapeHtml(time)}</p>
		</article>`;
}

/**
 * loginCtaTemplate
 * 비로그인 사용자가 일정 저장 기능을 발견할 수 있도록 안내하는 CTA를 렌더링한다.
 *
 * @returns {string} 로그인 CTA HTML
 */
export function loginCtaTemplate() {
	return `
		<div class="login-cta" data-component="login-cta">
			로그인하면 일정을 서버에 저장할 수 있어요.<br>
			<button type="button" id="taskLoginCta">로그인</button>
		</div>`;
}

/**
 * timetableHeaderTemplate
 * 시간표 상단의 요일 헤더 셀을 렌더링한다.
 *
 * @param {string} dayLabel - 월~금 요일 라벨
 * @param {Date} dayDate - 해당 요일의 실제 날짜
 * @param {boolean} isToday - 오늘 여부
 * @returns {string} 시간표 헤더 HTML
 */
export function timetableHeaderTemplate(dayLabel, dayDate, isToday) {
	return `
		<div class="tt-head ${isToday ? "today" : ""}">
			${escapeHtml(dayLabel)}
			<small>${dayDate.getMonth() + 1}/${dayDate.getDate()}</small>
		</div>`;
}

/**
 * timetableTimeTemplate
 * 시간표의 좌측 시간 라벨 셀을 렌더링한다.
 *
 * @param {number} hour - 표시할 시각
 * @param {number} row - CSS grid row index
 * @returns {string} 시간 라벨 HTML
 */
export function timetableTimeTemplate(hour, row) {
	return `<div class="tt-time" style="grid-column:1;grid-row:${row}">${String(hour).padStart(2, "0")}:00</div>`;
}

/**
 * timetableCellTemplate
 * 시간표의 빈 배경 셀을 렌더링한다.
 *
 * @param {number} column - CSS grid column index
 * @param {number} row - CSS grid row index
 * @returns {string} 빈 셀 HTML
 */
export function timetableCellTemplate(column, row) {
	return `<div class="tt-cell" style="grid-column:${column};grid-row:${row}"></div>`;
}

/**
 * classBlockTemplate
 * 시간표에 배치되는 강의 블록을 렌더링한다.
 *
 * @param {object} classItem - 강의 객체
 * @param {number} column - CSS grid column index
 * @param {number} row - CSS grid row index
 * @returns {string} 강의 블록 HTML
 */
export function classBlockTemplate(classItem, column, row) {
	return `
		<div class="tt-class ${escapeHtml(classItem.color || "")}" style="grid-column:${column};grid-row:${row} / span ${Number(classItem.duration) || 1}">
			<strong>${escapeHtml(classItem.name)}</strong>
			<small>${escapeHtml(classItem.time)} · ${escapeHtml(classItem.room)}</small>
		</div>`;
}

/**
 * timetableTaskTemplate
 * 시간표에 겹쳐 표시되는 일정 마감 블록을 렌더링한다.
 *
 * @param {object} task - 일정 객체
 * @param {number} column - CSS grid column index
 * @param {number} row - CSS grid row index
 * @returns {string} 일정 블록 HTML
 */
export function timetableTaskTemplate(task, column, row) {
	const time = task.time ? ` · ${task.time}` : "";
	return `
		<div class="tt-task" style="grid-column:${column};grid-row:${row}">
			<strong>${escapeHtml(task.title)}</strong>
			<small>${escapeHtml(task.type)}${escapeHtml(time)}</small>
		</div>`;
}

/**
 * userActionsTemplate
 * 로그인된 사용자 헤더 액션 영역을 렌더링한다.
 *
 * @param {object} user - 현재 로그인 사용자
 * @returns {string} 사용자 칩과 로그아웃 버튼 HTML
 */
export function userActionsTemplate(user) {
	const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();
	return `
		<div class="user-chip" data-component="user-chip">
			<div class="user-avatar">${escapeHtml(initial)}</div>
			<strong>${escapeHtml(user.name || user.email)}</strong>
		</div>
		<button class="header-btn" id="logoutBtn">로그아웃</button>`;
}

/**
 * guestActionsTemplate
 * 비로그인 상태의 헤더 액션 영역을 렌더링한다.
 *
 * @returns {string} 로그인 버튼 HTML
 */
export function guestActionsTemplate() {
	return `<button class="header-btn" id="loginBtn">로그인</button>`;
}

/**
 * emptyTemplate
 * 빈 상태 메시지를 일관된 마크업으로 렌더링한다.
 *
 * @param {string} message - 빈 상태 문구
 * @returns {string} 빈 상태 HTML
 */
export function emptyTemplate(message) {
	return `<div class="empty">${escapeHtml(message)}</div>`;
}
