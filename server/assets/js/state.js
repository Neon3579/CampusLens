/**
 * File: state.js
 * Purpose: CampusLens 프론트엔드의 런타임 상태를 한곳에서 관리한다.
 * Notes: 렌더러와 이벤트 모듈이 같은 객체 참조를 공유하므로, 화면 상태 변경은 이 파일의 state와
 *        setter 함수를 통해 이루어지도록 한다.
 */

import { TOKEN_KEY } from "./constants.js";
import { mondayOf, startOfDay } from "./date.js";

/**
 * state
 * 현재 페이지, 검색 조건, 인증 사용자, 공지/일정 목록처럼 앱 전체가 공유하는 상태다.
 */
export const state = {
	page: "dashboard",
	filter: "전체",
	query: "",
	weekStart: mondayOf(new Date()),
	mealDate: startOfDay(new Date()),
	authTab: "login",
	user: null,
	token: localStorage.getItem(TOKEN_KEY) || "",
	notices: [],
	tasks: [],
};

/**
 * restaurants
 * 공개 학식 API에서 로드한 식당 목록이다.
 */
export let restaurants = [];

/**
 * classes
 * 로그인 상태에 따라 사용자 시간표 또는 공개 기본 시간표를 담는다.
 */
export let classes = [];

/**
 * setRestaurants
 * 식당 목록을 안전하게 교체한다.
 *
 * @param {Array<object>} nextRestaurants - API에서 받은 식당 배열
 */
export function setRestaurants(nextRestaurants) {
	restaurants = Array.isArray(nextRestaurants) ? nextRestaurants : [];
}

/**
 * setClasses
 * 시간표 강의 목록을 안전하게 교체한다.
 *
 * @param {Array<object>} nextClasses - API에서 받은 강의 배열
 */
export function setClasses(nextClasses) {
	classes = Array.isArray(nextClasses) ? nextClasses : [];
}

/**
 * addClass
 * 비로그인 로컬 모드에서 새 강의를 현재 시간표 배열에 추가한다.
 *
 * @param {object} classItem - 화면에 즉시 추가할 강의 객체
 */
export function addClass(classItem) {
	classes = [...classes, classItem];
}

/**
 * setToken
 * 인증 토큰을 state와 localStorage에 동시에 반영한다.
 *
 * @param {string} token - API가 반환한 Bearer 토큰
 */
export function setToken(token) {
	state.token = token || "";
	if (state.token) {
		localStorage.setItem(TOKEN_KEY, state.token);
	} else {
		localStorage.removeItem(TOKEN_KEY);
	}
}
