/**
 * File: app.js
 * Purpose: CampusLens 프론트엔드의 ES module 진입점이다.
 * Notes: 이 파일은 앱 부팅 순서만 관리하고, 실제 API/렌더링/이벤트 세부 구현은 전용 모듈에 위임한다.
 */

import { loadClasses, loadNotices, loadRestaurants, loadTasks, refreshSession } from "./dataService.js";
import { setupEvents } from "./events.js";
import { renderAuthUI, renderChips, renderAll } from "./renderers.js";

/**
 * init
 * 초기 정적 UI를 렌더링하고 이벤트를 등록한 뒤 서버 데이터를 병렬 로드해 전체 화면을 완성한다.
 */
async function init() {
	renderAuthUI();
	renderChips();
	setupEvents();

	await refreshSession();
	await Promise.all([loadNotices(), loadRestaurants(), loadClasses(), loadTasks()]);

	renderAll();
}

init();
