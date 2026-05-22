/**
 * File: renderers.js
 * Purpose: 현재 state를 읽어 대시보드, 공지, 학식, 시간표, 인증 헤더를 화면에 그린다.
 * Notes: 이 파일은 DOM 출력만 담당하며 API 호출과 이벤트 등록은 각각 dataService.js, events.js가 맡는다.
 */

import { DAYS, HOURS, NOTICE_CATEGORIES } from "./constants.js";
import {
	classBlockTemplate,
	chipTemplate,
	emptyTemplate,
	guestActionsTemplate,
	loginCtaTemplate,
	noticeCardTemplate,
	restaurantPanelTemplate,
	statCardTemplate,
	taskCardTemplate,
	timetableCellTemplate,
	timetableHeaderTemplate,
	timetableTaskTemplate,
	timetableTimeTemplate,
	todayMealTemplate,
	urgentNoticeTemplate,
	userActionsTemplate,
} from "./components.js";
import { addDays, formatLongDate, formatMD, mondayOf, relativeDayLabel, sameDay } from "./date.js";
import { $id } from "./dom.js";
import { classes, restaurants, state } from "./state.js";

/**
 * getMealsForDate
 * 식당의 weeklyMeals 구조에서 특정 날짜의 식단 배열을 꺼낸다.
 *
 * @param {object} restaurant - 식당 객체
 * @param {Date} date - 조회할 날짜
 * @returns {Array<object>} 해당 날짜의 식단 배열
 */
export function getMealsForDate(restaurant, date) {
	const dow = date.getDay();
	return (restaurant.weeklyMeals && restaurant.weeklyMeals[dow]) || [];
}

/**
 * renderStats
 * 대시보드 상단의 요약 통계 카드를 렌더링한다.
 */
export function renderStats() {
	const today = new Date();
	const totalMeals = restaurants.reduce((sum, restaurant) => sum + getMealsForDate(restaurant, today).length, 0);
	const stats = [
		["수집 공지", state.notices.length, "공개 공지 기준"],
		["마감 임박", state.notices.filter((notice) => notice.urgent).length, "7일 이내 확인"],
		["등록 과목", classes.length, "사용자 시간표"],
		["오늘 메뉴", totalMeals, `${restaurants.length}개 식당`],
	];

	const target = $id("stats");
	if (target) target.innerHTML = stats.map(statCardTemplate).join("");
}

/**
 * renderChips
 * 공지 화면의 카테고리 필터 칩을 현재 선택 상태에 맞춰 렌더링한다.
 */
export function renderChips() {
	const target = $id("chips");
	if (!target) return;
	target.innerHTML = NOTICE_CATEGORIES.map((category) => chipTemplate(category, state.filter === category)).join("");
}

/**
 * renderNotices
 * 공지 목록과 대시보드의 마감 임박 공지 목록을 함께 렌더링한다.
 */
export function renderNotices() {
	const query = state.query.trim().toLowerCase();
	const filtered = state.notices
		.map((notice, index) => ({ notice, index }))
		.filter(({ notice }) => {
			const filterOk = state.filter === "전체" || notice.category === state.filter;
			const text = [notice.title, notice.category, notice.dept, notice.summary, ...(notice.tags || [])]
				.join(" ")
				.toLowerCase();
			return filterOk && (!query || text.includes(query));
		});

	const noticeList = $id("noticeList");
	if (noticeList) {
		noticeList.innerHTML = filtered.length
			? filtered.map(({ notice, index }) => noticeCardTemplate(notice, index)).join("")
			: emptyTemplate("검색 결과가 없습니다.");
	}

	const urgent = state.notices.map((notice, index) => ({ notice, index })).filter(({ notice }) => notice.urgent);
	const urgentList = $id("urgentNoticeList");
	if (urgentList) {
		urgentList.innerHTML = urgent.length
			? urgent.map(({ notice, index }) => urgentNoticeTemplate(notice, index)).join("")
			: emptyTemplate("마감 임박 공지가 없습니다.");
	}
}

/**
 * renderRestaurants
 * 선택된 학식 날짜의 식당별 식단 패널을 렌더링한다.
 */
export function renderRestaurants() {
	const label = $id("mealDateLabel");
	const relative = $id("mealDateRelative");
	const target = $id("restaurantList");

	if (label) label.textContent = formatLongDate(state.mealDate);
	if (relative) relative.textContent = relativeDayLabel(state.mealDate);
	if (!target) return;

	target.innerHTML = restaurants.length
		? restaurants.map((restaurant) => restaurantPanelTemplate(restaurant, getMealsForDate(restaurant, state.mealDate))).join("")
		: emptyTemplate("등록된 식당 정보가 없습니다.");
}

/**
 * renderTodayMeals
 * 대시보드에 오늘 점심 메뉴 요약을 렌더링한다.
 */
export function renderTodayMeals() {
	const today = new Date();
	const items = [];

	restaurants.forEach((restaurant) => {
		const lunch = getMealsForDate(restaurant, today).find((meal) => meal.type === "점심");
		if (lunch) items.push({ place: restaurant.name, meal: lunch });
	});

	const target = $id("todayMealList");
	if (!target) return;
	target.innerHTML = items.length
		? items.map(todayMealTemplate).join("")
		: emptyTemplate("오늘 운영하는 식당이 없습니다.");
}

/**
 * renderUpcomingTasks
 * 대시보드에 마감일 기준 가장 가까운 일정 3개를 렌더링한다.
 */
export function renderUpcomingTasks() {
	const upcoming = state.tasks
		.slice()
		.sort((a, b) => new Date(a.due) - new Date(b.due))
		.slice(0, 3);

	const target = $id("upcomingTaskList");
	if (!target) return;
	target.innerHTML = upcoming.length
		? upcoming.map((task) => taskCardTemplate(task, formatMD(task.due))).join("")
		: emptyTemplate("등록된 일정이 없습니다.");
}

/**
 * dayColIndex
 * 요일 라벨을 시간표 CSS grid column 번호로 변환한다.
 *
 * @param {string} dayLabel - 월~금 중 하나
 * @returns {number} grid column 번호. 지원하지 않는 요일이면 -1
 */
function dayColIndex(dayLabel) {
	const index = DAYS.indexOf(dayLabel);
	return index >= 0 ? index + 2 : -1;
}

/**
 * hourRowIndex
 * HH:mm 형태의 시간을 시간표 CSS grid row 번호로 변환한다.
 *
 * @param {string} time - HH:mm 시간 문자열
 * @returns {number} grid row 번호. 표시 범위 밖이면 -1
 */
function hourRowIndex(time) {
	const hour = parseInt(String(time).split(":")[0], 10);
	const index = HOURS.indexOf(hour);
	return index >= 0 ? index + 2 : -1;
}

/**
 * renderTimeTable
 * 선택 주차의 월~금 시간표 그리드, 강의 블록, 일정 마감 블록을 렌더링한다.
 */
export function renderTimeTable() {
	const start = state.weekStart;
	const end = addDays(start, 4);
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const weekLabel = $id("weekLabel");
	if (weekLabel) {
		weekLabel.textContent = `${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getMonth() + 1}월 ${end.getDate()}일`;
	}

	const weeksFromToday = Math.round((start - mondayOf(today)) / (7 * 24 * 60 * 60 * 1000));
	const weekRange = $id("weekRange");
	if (weekRange) {
		weekRange.textContent =
			weeksFromToday === 0 ? "이번 주" : weeksFromToday > 0 ? `${weeksFromToday}주 후` : `${Math.abs(weeksFromToday)}주 전`;
	}

	const grid = $id("timetableGrid");
	if (!grid) return;
	grid.style.gridTemplateRows = `50px repeat(${HOURS.length}, 56px)`;

	let html = `<div class="tt-corner"></div>`;
	DAYS.forEach((day, index) => {
		const dayDate = addDays(start, index);
		html += timetableHeaderTemplate(day, dayDate, sameDay(dayDate, today));
	});

	HOURS.forEach((hour, hourIndex) => {
		const row = hourIndex + 2;
		html += timetableTimeTemplate(hour, row);
		DAYS.forEach((_, dayIndex) => {
			html += timetableCellTemplate(dayIndex + 2, row);
		});
	});

	classes.forEach((classItem) => {
		const column = dayColIndex(classItem.day);
		const row = hourRowIndex(classItem.time);
		if (column < 0 || row < 0) return;
		html += classBlockTemplate(classItem, column, row);
	});

	const weekTasks = state.tasks.filter((task) => {
		const due = new Date(task.due);
		due.setHours(0, 0, 0, 0);
		return due >= start && due <= addDays(start, 4);
	});

	weekTasks.forEach((task) => {
		const due = new Date(task.due);
		const dayIndex = (due.getDay() + 6) % 7;
		if (dayIndex > 4) return;

		const column = dayIndex + 2;
		const hour = task.time ? parseInt(task.time.split(":")[0], 10) : 18;
		const hourIndex = HOURS.indexOf(hour);
		const row = hourIndex >= 0 ? hourIndex + 2 : HOURS.length + 1;
		html += timetableTaskTemplate(task, column, row);
	});

	grid.innerHTML = html;
}

/**
 * renderTasks
 * 시간표 페이지 하단의 이번 주 일정 목록과 비로그인 CTA를 렌더링한다.
 */
export function renderTasks() {
	const start = state.weekStart;
	const end = addDays(start, 6);
	const weekTasks = state.tasks
		.filter((task) => {
			const due = new Date(task.due);
			return due >= start && due <= end;
		})
		.sort((a, b) => new Date(a.due) - new Date(b.due));

	const list = weekTasks.length
		? weekTasks.map((task) => taskCardTemplate(task, formatMD(task.due))).join("")
		: emptyTemplate("이번 주에 등록된 일정이 없습니다.");
	const cta = state.user ? "" : loginCtaTemplate();
	const target = $id("taskList");
	if (target) target.innerHTML = list + cta;

	renderUpcomingTasks();
}

/**
 * renderAuthUI
 * 헤더 우측 영역을 로그인/비로그인 상태에 맞춰 렌더링한다.
 */
export function renderAuthUI() {
	const actions = $id("headerActions");
	if (!actions) return;
	actions.innerHTML = state.user ? userActionsTemplate(state.user) : guestActionsTemplate();
}

/**
 * renderAll
 * 초기 로딩이나 인증 상태 변경 이후 전체 화면을 현재 상태와 동기화한다.
 */
export function renderAll() {
	renderAuthUI();
	renderStats();
	renderNotices();
	renderRestaurants();
	renderTodayMeals();
	renderTimeTable();
	renderTasks();
}
