/**
 * File: constants.js
 * Purpose: 프론트엔드 전체에서 공유하는 정적 설정값과 표기 규칙을 모아 둔다.
 * Notes: 화면 렌더링과 API 통신 양쪽에서 쓰이는 값은 이 파일에서만 바꾸도록 하여
 *        모듈 간 중복 상수를 줄인다.
 */

/**
 * API_BASE
 * 같은 Express 서버가 정적 파일과 API를 모두 제공하므로 빈 문자열을 기본값으로 둔다.
 */
export const API_BASE = "";

/**
 * TOKEN_KEY
 * 로그인 API가 반환한 Bearer 토큰을 localStorage에 저장할 때 사용하는 키다.
 */
export const TOKEN_KEY = "campuslens_token";

/**
 * HOURS
 * 시간표 그리드에 표시할 시간대다. 각 숫자는 한 시간 블록의 시작 시각을 의미한다.
 */
export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/**
 * DAYS
 * CampusLens 시간표가 지원하는 평일 요일 목록이다.
 */
export const DAYS = ["월", "화", "수", "목", "금"];

/**
 * DOW_LABELS
 * Date.getDay() 결과를 한국어 요일 라벨로 바꾸기 위한 배열이다.
 */
export const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * TYPE_TO_MEAL_CLASS
 * 식사 유형을 시각적 배지 클래스와 연결한다.
 */
export const TYPE_TO_MEAL_CLASS = {
	아침: "brk",
	점심: "lun",
	저녁: "din",
};

/**
 * CLASS_COLOR_POOL
 * 사용자가 색상을 직접 지정하지 않은 강의에 순환 적용할 시간표 색상 클래스다.
 */
export const CLASS_COLOR_POOL = ["", "color-b", "color-c", "color-d", "color-e"];

/**
 * NOTICE_CATEGORIES
 * 공지 화면의 필터 칩으로 노출되는 고정 카테고리 목록이다.
 */
export const NOTICE_CATEGORIES = ["전체", "학사", "대회", "자격증", "비교과"];

/**
 * HASH_PAGES
 * URL hash로 직접 이동할 수 있는 앱 페이지 목록이다.
 */
export const HASH_PAGES = new Set(["dashboard", "notices", "meals", "schedule"]);
