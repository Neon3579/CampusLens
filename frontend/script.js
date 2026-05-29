(function () {

	const API_BASE = "http://127.0.0.1:3001";

	const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
	const DAYS = ["월", "화", "수", "목", "금"];
	const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
	const TYPE_TO_MEAL_CLASS = { 아침: "brk", 점심: "lun", 저녁: "din" };
	const CLASS_COLOR_POOL = ["", "color-b", "color-c", "color-d", "color-e"];
	const NOTICE_CATEGORIES = ["전체", "학사", "장학", "취업", "행사", "기타"];
	const HASH_PAGES = new Set(["dashboard", "notices", "meals", "schedule"]);

	const state = {
		page: "dashboard",
		filter: "전체",
		query: "",
		weekStart: mondayOf(new Date()),
		mealDate: startOfDay(new Date()),
		authTab: "login",
		user: null,
		notices: [],
		tasks: [],
		restaurants: [],
		classes: [],
	};

	function $id(id) { return document.getElementById(id); }

	function toast(message) {
		const target = $id("toast");
		if (!target) return;
		target.textContent = message;
		target.classList.add("show");
		clearTimeout(toast.timer);
		toast.timer = setTimeout(() => target.classList.remove("show"), 2200);
	}

	function switchPage(page) {
		const targetPage = $id(`page-${page}`);
		if (!targetPage) return;
		state.page = page;
		document.querySelectorAll(".app-page").forEach((s) => s.classList.remove("active"));
		targetPage.classList.add("active");
		document.querySelectorAll(".nav-bar button").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
	}

	function startOfDay(date) {
		const d = new Date(date);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function mondayOf(date) {
		const d = startOfDay(date);
		const day = d.getDay();
		const diff = day === 0 ? -6 : 1 - day;
		d.setDate(d.getDate() + diff);
		return d;
	}

	function addDays(date, n) {
		const d = new Date(date);
		d.setDate(d.getDate() + n);
		return d;
	}

	function sameDay(a, b) {
		return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
	}

	function formatMD(date) {
		const d = date instanceof Date ? date : new Date(date);
		if (Number.isNaN(d.getTime())) return String(date);
		return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
	}

	function formatLongDate(date) {
		return `${date.getMonth() + 1}월 ${date.getDate()}일 (${DOW_LABELS[date.getDay()]})`;
	}

	function relativeDayLabel(date) {
		const today = startOfDay(new Date());
		const diff = Math.round((startOfDay(date) - today) / (24 * 60 * 60 * 1000));
		if (diff === 0) return "오늘";
		if (diff === 1) return "내일";
		if (diff === -1) return "어제";
		return diff > 0 ? `${diff}일 후` : `${Math.abs(diff)}일 전`;
	}

	async function apiFetch(path, options = {}) {
		const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
		const response = await fetch(`${API_BASE}${path}`, {
			credentials: "include",
			...options,
			headers,
		});
		let data = null;
		try { data = await response.json(); } catch (_) { data = null; }
		if (!response.ok) {
			const error = new Error((data && data.message) || `요청 실패 (${response.status})`);
			error.status = response.status;
			error.code = data && data.error;
			throw error;
		}
		return data;
	}

	const HTML_ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
	function escapeHtml(value) {
		return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
	}

	function safeBackground(value) {
		const raw = String(value || "").trim();
		const safeGradient = /^(linear-gradient|radial-gradient)\([^<>";]+\)$/i.test(raw);
		const safeColor = /^(#[0-9a-f]{3,8}|rgb\([0-9,\s.]+\)|rgba\([0-9,\s.]+\))$/i.test(raw);
		return safeGradient || safeColor ? raw : "";
	}

	function tagListTemplate(tags = []) {
		return tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join("");
	}

	function badgeTemplate(label, className = "") {
		return `<span class="badge ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
	}

	function statCardTemplate(stat) {
		return `
			<article class="card stat-card" data-component="stat-card">
				<small>${escapeHtml(stat[0])}</small>
				<strong>${escapeHtml(stat[1])}</strong>
				<span>${escapeHtml(stat[2])}</span>
			</article>`;
	}

	function chipTemplate(category, active) {
		return `<button class="chip ${active ? "active" : ""}" data-cat="${escapeHtml(category)}">${escapeHtml(category)}</button>`;
	}

	function noticeCardTemplate(notice, originIndex) {
		const background = safeBackground(notice.image);
		const hasImage = Boolean(background);
		const cardClass = `notice-card ${hasImage ? "" : "no-thumb"} ${!hasImage && notice.urgent ? "urgent" : ""}`.trim();
		const thumb = hasImage
			? `<div class="notice-thumb" style="background:${background}"><span>${escapeHtml(notice.icon || "")}</span></div>`
			: "";
		const deadlineClass = notice.urgent ? "deadline-pill warn" : "deadline-pill";
		const deadline = notice.deadline ? `<span class="${deadlineClass}">마감 ${escapeHtml(notice.deadline)}</span>` : "";
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

	function urgentNoticeTemplate(notice, originIndex) {
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

	function mealRowTemplate(meal) {
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

	function restaurantPanelTemplate(restaurant, meals) {
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

	function todayMealTemplate(item) {
		return `
			<article class="task" data-component="today-meal">
				<span class="badge green">점심</span>
				<strong class="task-title">${escapeHtml(item.place)} · ${escapeHtml(item.meal.menu)}</strong>
				<p>${escapeHtml(item.meal.desc)} · ${escapeHtml(item.meal.time)}</p>
			</article>`;
	}

	function taskCardTemplate(task, formattedDue) {
		const course = task.course ? `${task.course} · ` : "";
		const time = task.time ? ` ${task.time}` : "";
		return `
			<article class="task" data-component="task-card" data-task-id="${escapeHtml(task.id)}">
				<span class="badge">${escapeHtml(task.type)}</span>
				<strong class="task-title">${escapeHtml(task.title)}</strong>
				<p>${escapeHtml(course)}마감 ${escapeHtml(formattedDue)}${escapeHtml(time)}</p>
				${state.user ? `<button class="task-delete" data-task-delete="${escapeHtml(task.id)}" aria-label="일정 삭제">삭제</button>` : ""}
			</article>`;
	}

	function loginCtaTemplate() {
		return `
			<div class="login-cta" data-component="login-cta">
				로그인하면 일정을 서버에 저장할 수 있어요.<br>
				<button type="button" id="taskLoginCta">로그인</button>
			</div>`;
	}

	function timetableHeaderTemplate(dayLabel, dayDate, isToday) {
		return `
			<div class="tt-head ${isToday ? "today" : ""}">
				${escapeHtml(dayLabel)}
				<small>${dayDate.getMonth() + 1}/${dayDate.getDate()}</small>
			</div>`;
	}

	function timetableTimeTemplate(hour, row) {
		return `<div class="tt-time" style="grid-column:1;grid-row:${row}">${String(hour).padStart(2, "0")}:00</div>`;
	}

	function timetableCellTemplate(column, row) {
		return `<div class="tt-cell" style="grid-column:${column};grid-row:${row}"></div>`;
	}

	function classBlockTemplate(classItem, column, row) {
		const deleteBtn = state.user
			? `<button class="tt-class-delete" data-class-delete="${escapeHtml(classItem.id)}" aria-label="강의 삭제">✕</button>`
			: "";
		return `
			<div class="tt-class ${escapeHtml(classItem.color || "")}" style="grid-column:${column};grid-row:${row} / span ${Number(classItem.duration) || 1}">
				<strong>${escapeHtml(classItem.name)}</strong>
				<small>${escapeHtml(classItem.time)} · ${escapeHtml(classItem.room)}</small>
				${deleteBtn}
			</div>`;
	}

	function timetableTaskTemplate(task, column, row) {
		const time = task.time ? ` · ${task.time}` : "";
		return `
			<div class="tt-task" style="grid-column:${column};grid-row:${row}">
				<strong>${escapeHtml(task.title)}</strong>
				<small>${escapeHtml(task.type)}${escapeHtml(time)}</small>
			</div>`;
	}

	function userActionsTemplate(user) {
		const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();
		return `
			<div class="user-chip" data-component="user-chip">
				<div class="user-avatar">${escapeHtml(initial)}</div>
				<strong>${escapeHtml(user.name || user.email)}</strong>
			</div>
			<button class="header-btn" id="logoutBtn">로그아웃</button>`;
	}

	function guestActionsTemplate() {
		return `<button class="header-btn" id="loginBtn">로그인</button>`;
	}

	function emptyTemplate(message) {
		return `<div class="empty">${escapeHtml(message)}</div>`;
	}

	async function refreshSession() {
		try {
			const { user } = await apiFetch("/api/auth/me");
			state.user = user;
			return true;
		} catch (_) {
			state.user = null;
			return false;
		}
	}

	async function loginUser(email, password) {
		const data = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
		state.user = data.user;
		return data;
	}

	async function signupUser(email, password, name) {
		const data = await apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) });
		state.user = data.user;
		return data;
	}

	async function logoutUser() {
		try { await apiFetch("/api/auth/logout", { method: "POST" }); }
		catch (_) {}
		state.user = null;
	}

	function normalizeNotice(n) {
		return {
			id: n.id || "",
			title: n.title || "",
			category: n.category || "공지",
			dept: n.dept || "전체",
			deadline: n.deadline || "",
			summary: n.summary || "",
			content: n.content || n.body || "",
			url: n.url || n.link || n.sourceUrl || "",
			image: n.image || null,
			icon: n.icon || null,
			tags: Array.isArray(n.tags) ? n.tags : [],
			urgent: Boolean(n.urgent),
			attachments: Array.isArray(n.attachments) ? n.attachments : [],
		};
	}

	async function loadNotices() {
		try {
			const { notices } = await apiFetch("/api/public-data/notices");
			state.notices = Array.isArray(notices) ? notices.map(normalizeNotice) : [];
		} catch (e) {
			console.warn("공지 API 로드 실패", e);
			state.notices = [];
		}
	}

	async function loadRestaurants() {
		try {
			const { restaurants } = await apiFetch("/api/public-data/restaurants");
			state.restaurants = Array.isArray(restaurants) ? restaurants : [];
		} catch (e) {
			console.warn("학식 API 로드 실패", e);
			state.restaurants = [];
		}
	}

	function normalizeClass(c, index) {
		return {
			id: c.id,
			day: c.day,
			time: c.time,
			duration: c.duration,
			name: c.name,
			room: c.room || "",
			color: c.color || CLASS_COLOR_POOL[index % CLASS_COLOR_POOL.length],
		};
	}

	async function loadClasses() {
		if (!state.user) {
			state.classes = [];
			return;
		}
		try {
			const { classes } = await apiFetch("/api/classes");
			state.classes = Array.isArray(classes) ? classes.map(normalizeClass) : [];
		} catch (e) {
			console.warn("강의 API 로드 실패", e);
			state.classes = [];
		}
	}

	async function loadTasks() {
		if (!state.user) {
			state.tasks = [];
			return;
		}
		try {
			const { tasks } = await apiFetch("/api/tasks");
			state.tasks = (tasks || []).map((t) => ({
				id: t.id,
				title: t.title,
				course: t.course || "",
				type: t.type || "과제",
				due: t.due,
				time: t.time || "",
			}));
		} catch (e) {
			console.warn("일정 API 로드 실패", e);
			state.tasks = [];
		}
	}

	async function createTask(payload) {
		const { task } = await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
		return task;
	}

	async function deleteTask(id) {
		await apiFetch(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
	}

	async function createClass(payload) {
		const { class: created } = await apiFetch("/api/classes", { method: "POST", body: JSON.stringify(payload) });
		return created;
	}

	async function deleteClass(id) {
		await apiFetch(`/api/classes/${encodeURIComponent(id)}`, { method: "DELETE" });
	}

	function getMealsForDate(restaurant, date) {
		const dow = date.getDay();
		return (restaurant.weeklyMeals && restaurant.weeklyMeals[dow]) || [];
	}

	function renderStats() {
		const today = new Date();
		const totalMeals = state.restaurants.reduce((sum, r) => sum + getMealsForDate(r, today).length, 0);
		const stats = [
			["수집 공지", state.notices.length, "공개 공지 기준"],
			["마감 임박", state.notices.filter((n) => n.urgent).length, "7일 이내 확인"],
			["등록 과목", state.classes.length, "사용자 시간표"],
			["오늘 메뉴", totalMeals, `${state.restaurants.length}개 식당`],
		];
		const target = $id("stats");
		if (target) target.innerHTML = stats.map(statCardTemplate).join("");
	}

	function renderChips() {
		const target = $id("chips");
		if (!target) return;
		target.innerHTML = NOTICE_CATEGORIES.map((c) => chipTemplate(c, state.filter === c)).join("");
	}

	function renderNotices() {
		const query = state.query.trim().toLowerCase();
		const filtered = state.notices
			.map((notice, index) => ({ notice, index }))
			.filter(({ notice }) => {
				const filterOk = state.filter === "전체" || notice.category === state.filter;
				const text = [notice.title, notice.category, notice.dept, notice.summary, ...(notice.tags || [])]
					.join(" ").toLowerCase();
				return filterOk && (!query || text.includes(query));
			});

		const noticeList = $id("noticeList");
		if (noticeList) {
			noticeList.innerHTML = filtered.length
				? filtered.map(({ notice, index }) => noticeCardTemplate(notice, index)).join("")
				: emptyTemplate("검색 결과가 없습니다.");
		}

		const urgent = state.notices.map((n, i) => ({ notice: n, index: i })).filter(({ notice }) => notice.urgent);
		const urgentList = $id("urgentNoticeList");
		if (urgentList) {
			urgentList.innerHTML = urgent.length
				? urgent.map(({ notice, index }) => urgentNoticeTemplate(notice, index)).join("")
				: emptyTemplate("마감 임박 공지가 없습니다.");
		}
	}

	function renderRestaurants() {
		const label = $id("mealDateLabel");
		const relative = $id("mealDateRelative");
		const target = $id("restaurantList");
		if (label) label.textContent = formatLongDate(state.mealDate);
		if (relative) relative.textContent = relativeDayLabel(state.mealDate);
		if (!target) return;
		target.innerHTML = state.restaurants.length
			? state.restaurants.map((r) => restaurantPanelTemplate(r, getMealsForDate(r, state.mealDate))).join("")
			: emptyTemplate("등록된 식당 정보가 없습니다.");
	}

	function renderTodayMeals() {
		const today = new Date();
		const items = [];
		state.restaurants.forEach((r) => {
			const lunch = getMealsForDate(r, today).find((m) => m.type === "점심");
			if (lunch) items.push({ place: r.name, meal: lunch });
		});
		const target = $id("todayMealList");
		if (!target) return;
		target.innerHTML = items.length ? items.map(todayMealTemplate).join("") : emptyTemplate("오늘 운영하는 식당이 없습니다.");
	}

	function renderUpcomingTasks() {
		const upcoming = state.tasks.slice().sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 3);
		const target = $id("upcomingTaskList");
		if (!target) return;
		target.innerHTML = upcoming.length
			? upcoming.map((t) => taskCardTemplate(t, formatMD(t.due))).join("")
			: emptyTemplate("등록된 일정이 없습니다.");
	}

	function dayColIndex(label) {
		const i = DAYS.indexOf(label);
		return i >= 0 ? i + 2 : -1;
	}

	function hourRowIndex(time) {
		const hour = parseInt(String(time).split(":")[0], 10);
		const i = HOURS.indexOf(hour);
		return i >= 0 ? i + 2 : -1;
	}

	function renderTimeTable() {
		const start = state.weekStart;
		const end = addDays(start, 4);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const weekLabel = $id("weekLabel");
		if (weekLabel) weekLabel.textContent = `${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getMonth() + 1}월 ${end.getDate()}일`;

		const weeksFromToday = Math.round((start - mondayOf(today)) / (7 * 24 * 60 * 60 * 1000));
		const weekRange = $id("weekRange");
		if (weekRange) weekRange.textContent = weeksFromToday === 0 ? "이번 주" : weeksFromToday > 0 ? `${weeksFromToday}주 후` : `${Math.abs(weeksFromToday)}주 전`;

		const grid = $id("timetableGrid");
		if (!grid) return;
		grid.style.gridTemplateRows = `50px repeat(${HOURS.length}, 56px)`;

		let html = `<div class="tt-corner"></div>`;
		DAYS.forEach((day, idx) => {
			const dayDate = addDays(start, idx);
			html += timetableHeaderTemplate(day, dayDate, sameDay(dayDate, today));
		});
		HOURS.forEach((hour, hi) => {
			const row = hi + 2;
			html += timetableTimeTemplate(hour, row);
			DAYS.forEach((_, di) => { html += timetableCellTemplate(di + 2, row); });
		});

		state.classes.forEach((c) => {
			const col = dayColIndex(c.day);
			const row = hourRowIndex(c.time);
			if (col < 0 || row < 0) return;
			html += classBlockTemplate(c, col, row);
		});

		const weekTasks = state.tasks.filter((t) => {
			const due = new Date(t.due);
			due.setHours(0, 0, 0, 0);
			return due >= start && due <= addDays(start, 4);
		});

		weekTasks.forEach((t) => {
			const due = new Date(t.due);
			const dayIdx = (due.getDay() + 6) % 7;
			if (dayIdx > 4) return;
			const col = dayIdx + 2;
			const hour = t.time ? parseInt(t.time.split(":")[0], 10) : 18;
			const hi = HOURS.indexOf(hour);
			const row = hi >= 0 ? hi + 2 : HOURS.length + 1;
			html += timetableTaskTemplate(t, col, row);
		});

		grid.innerHTML = html;
	}

	function renderTasks() {
		const start = state.weekStart;
		const end = addDays(start, 6);
		const weekTasks = state.tasks
			.filter((t) => {
				const due = new Date(t.due);
				return due >= start && due <= end;
			})
			.sort((a, b) => new Date(a.due) - new Date(b.due));
		const list = weekTasks.length
			? weekTasks.map((t) => taskCardTemplate(t, formatMD(t.due))).join("")
			: emptyTemplate("이번 주에 등록된 일정이 없습니다.");
		const cta = state.user ? "" : loginCtaTemplate();
		const target = $id("taskList");
		if (target) target.innerHTML = list + cta;
		renderUpcomingTasks();
	}

	function renderAuthUI() {
		const actions = $id("headerActions");
		if (!actions) return;
		actions.innerHTML = state.user ? userActionsTemplate(state.user) : guestActionsTemplate();
	}

	function renderAll() {
		renderAuthUI();
		renderStats();
		renderNotices();
		renderRestaurants();
		renderTodayMeals();
		renderTimeTable();
		renderTasks();
	}

	function openClassModal() {
		const form = $id("classForm");
		if (form) form.reset();
		if (!state.user) {
			toast("로그인하면 강의가 서버에 저장됩니다.");
			openAuthModal("login");
			return;
		}
		$id("classModal")?.classList.add("show");
	}
	function closeClassModal() { $id("classModal")?.classList.remove("show"); }

	function openTaskModal() {
		if (!state.user) {
			toast("로그인하면 일정이 서버에 저장됩니다.");
			openAuthModal("login");
			return;
		}
		$id("taskModal")?.classList.add("show");
		setTimeout(() => $id("taskForm")?.querySelector("input[name='title']")?.focus(), 50);
	}
	function closeTaskModal() {
		$id("taskModal")?.classList.remove("show");
		$id("taskForm")?.reset();
	}

	function setAuthTab(tab) {
		state.authTab = tab;
		document.querySelectorAll(".modal-tabs button[data-auth-tab]").forEach((b) => b.classList.toggle("active", b.dataset.authTab === tab));
		const title = $id("authModalTitle");
		if (title) title.textContent = tab === "login" ? "로그인" : "회원가입";
		const submit = $id("authSubmitBtn");
		if (submit) submit.textContent = tab === "login" ? "로그인" : "가입하기";
		document.querySelectorAll('#authForm [data-only="signup"]').forEach((el) => el.classList.toggle("auth-only-signup", tab !== "signup"));
		const nameInput = document.querySelector('#authForm input[name="name"]');
		if (nameInput) nameInput.required = tab === "signup";
		const pwInput = document.querySelector('#authForm input[name="password"]');
		if (pwInput) pwInput.setAttribute("autocomplete", tab === "login" ? "current-password" : "new-password");
		setAuthMsg("");
	}

	function openAuthModal(tab = "login") {
		setAuthTab(tab);
		$id("authModal")?.classList.add("show");
		setTimeout(() => $id("authForm")?.querySelector("input[name='email']")?.focus(), 50);
	}
	function closeAuthModal() {
		$id("authModal")?.classList.remove("show");
		$id("authForm")?.reset();
		setAuthMsg("");
	}

	function setAuthMsg(message, type = "error") {
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

	function openNoticeDetail(index) {
		const notice = state.notices[index];
		if (!notice) return;
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
		if (meta) meta.innerHTML = badgeTemplate(notice.category, notice.urgent ? "warn" : "") + badgeTemplate(notice.dept, "gray");
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
		$id("noticeDetailModal")?.classList.add("show");
	}

	function closeNoticeDetail() { $id("noticeDetailModal")?.classList.remove("show"); }

	function closeAllModals() {
		if ($id("taskModal")?.classList.contains("show")) closeTaskModal();
		if ($id("classModal")?.classList.contains("show")) closeClassModal();
		if ($id("authModal")?.classList.contains("show")) closeAuthModal();
		if ($id("noticeDetailModal")?.classList.contains("show")) closeNoticeDetail();
	}

	function applyHash() {
		const hashPage = location.hash.replace(/^#/, "");
		if (HASH_PAGES.has(hashPage)) switchPage(hashPage);
	}

	async function refreshAfterAuthChange() {
		await Promise.all([loadTasks(), loadClasses()]);
		renderAuthUI();
		renderStats();
		renderTimeTable();
		renderTasks();
	}

	async function handleDocumentClick(event) {
		const target = event.target instanceof Element ? event.target : event.target.parentElement;
		if (!target) return;

		const taskDeleteBtn = target.closest("[data-task-delete]");
		if (taskDeleteBtn) {
			event.stopPropagation();
			const id = taskDeleteBtn.getAttribute("data-task-delete");
			try {
				await deleteTask(id);
				await loadTasks();
				renderStats();
				renderTimeTable();
				renderTasks();
				toast("일정이 삭제되었습니다.");
			} catch (e) {
				toast(e.message || "삭제 실패");
			}
			return;
		}

		const classDeleteBtn = target.closest("[data-class-delete]");
		if (classDeleteBtn) {
			event.stopPropagation();
			const id = classDeleteBtn.getAttribute("data-class-delete");
			try {
				await deleteClass(id);
				await loadClasses();
				renderStats();
				renderTimeTable();
				toast("강의가 삭제되었습니다.");
			} catch (e) {
				toast(e.message || "삭제 실패");
			}
			return;
		}

		const chip = target.closest(".chip[data-cat]");
		if (chip) {
			state.filter = chip.dataset.cat;
			renderChips();
			renderNotices();
			return;
		}

		const loginBtn = target.closest("#loginBtn, #taskLoginCta");
		if (loginBtn) { openAuthModal("login"); return; }

		const logoutBtn = target.closest("#logoutBtn");
		if (logoutBtn) {
			await logoutUser();
			await refreshAfterAuthChange();
			toast("로그아웃되었습니다.");
			return;
		}

		const authTab = target.closest(".modal-tabs button[data-auth-tab]");
		if (authTab) { setAuthTab(authTab.dataset.authTab); return; }

		const noticeCard = target.closest("[data-notice-index]");
		if (noticeCard && !target.closest("a")) {
			const index = Number(noticeCard.dataset.noticeIndex);
			if (!Number.isNaN(index)) openNoticeDetail(index);
		}
	}

	function handleNoticeKeydown(event) {
		const target = event.target instanceof Element ? event.target : event.target.parentElement;
		const card = target?.closest("[data-notice-index]");
		if (!card || (event.key !== "Enter" && event.key !== " ")) return;
		event.preventDefault();
		const index = Number(card.dataset.noticeIndex);
		if (!Number.isNaN(index)) openNoticeDetail(index);
	}

	function handleEscapeKey(event) { if (event.key === "Escape") closeAllModals(); }

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
			await loadTasks();
			closeTaskModal();
			renderStats();
			renderTimeTable();
			renderTasks();
			toast("일정이 추가되었습니다.");
		} catch (e) { toast(e.message || "일정 추가 실패"); }
	}

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
			await loadClasses();
			closeClassModal();
			renderStats();
			renderTimeTable();
			toast("강의가 시간표에 추가되었습니다.");
		} catch (e) { toast(e.message || "강의 추가 실패"); }
	}

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
				if (!name) { setAuthMsg("이름을 입력해주세요."); return; }
				await signupUser(email, password, name);
			}
			closeAuthModal();
			await refreshAfterAuthChange();
			toast(`${state.user.name || state.user.email}님, 환영합니다.`);
		} catch (e) { setAuthMsg(e.message || "요청 실패"); }
	}

	function setupWeekControls() {
		$id("prevWeekBtn")?.addEventListener("click", () => {
			state.weekStart = addDays(state.weekStart, -7);
			renderTimeTable(); renderTasks();
		});
		$id("nextWeekBtn")?.addEventListener("click", () => {
			state.weekStart = addDays(state.weekStart, 7);
			renderTimeTable(); renderTasks();
		});
		$id("todayBtn")?.addEventListener("click", () => {
			state.weekStart = mondayOf(new Date());
			renderTimeTable(); renderTasks();
		});
	}

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

	function setupModalControls() {
		$id("openTaskModalBtn")?.addEventListener("click", openTaskModal);
		$id("modalCloseBtn")?.addEventListener("click", closeTaskModal);
		$id("modalCancelBtn")?.addEventListener("click", closeTaskModal);
		$id("taskModal")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeTaskModal(); });

		$id("openClassModalBtn")?.addEventListener("click", openClassModal);
		$id("classCloseBtn")?.addEventListener("click", closeClassModal);
		$id("classCancelBtn")?.addEventListener("click", closeClassModal);
		$id("classModal")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeClassModal(); });

		$id("authCloseBtn")?.addEventListener("click", closeAuthModal);
		$id("authCancelBtn")?.addEventListener("click", closeAuthModal);
		$id("authModal")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeAuthModal(); });

		$id("noticeDetailCloseBtn")?.addEventListener("click", closeNoticeDetail);
		$id("noticeDetailModal")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeNoticeDetail(); });
	}

	function toggleAiPanel(force) {
		const panel = $id("aiPanel");
		if (!panel) return;
		const open = force ?? panel.hidden;
		panel.hidden = !open;
		if (open) setTimeout(() => $id("aiInput")?.focus(), 50);
	}

	function appendAiMessage(role, text) {
		const list = $id("aiMessages");
		if (!list) return null;
		const div = document.createElement("div");
		div.className = `ai-msg ${role}`;
		div.textContent = text;
		list.appendChild(div);
		list.scrollTop = list.scrollHeight;
		return div;
	}

	function aiSourceCardTemplate(s) {
		if (s.type === "notice") {
			const meta = [s.dept, s.date].filter(Boolean).join(" · ");
			if (s.url) {
				return `<a class="ai-source-card" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)}<small>${escapeHtml(meta)}</small></a>`;
			}
			return `<div class="ai-source-card">${escapeHtml(s.title)}<small>${escapeHtml(meta)}</small></div>`;
		}
		return `<div class="ai-source-card">${escapeHtml(s.name)}<small>${escapeHtml(s.desc || "")}</small></div>`;
	}

	function appendAiSources(sources) {
		const list = $id("aiMessages");
		if (!list || !Array.isArray(sources) || sources.length === 0) return;
		const wrap = document.createElement("div");
		wrap.className = "ai-sources";
		wrap.innerHTML = sources.map(aiSourceCardTemplate).join("");
		list.appendChild(wrap);
		list.scrollTop = list.scrollHeight;
	}

	async function handleAiSubmit(e) {
		e.preventDefault();
		const input = $id("aiInput");
		const question = input?.value.trim();
		if (!question) return;
		appendAiMessage("user", question);
		input.value = "";
		const loading = appendAiMessage("bot", "생각 중…");
		if (!loading) return;
		try {
			const data = await apiFetch("/api/ai/query", {
				method: "POST",
				body: JSON.stringify({ question }),
			});
			loading.textContent = data.answer || "응답이 없습니다.";
			appendAiSources(data.sources);
		} catch (err) {
			loading.className = "ai-msg error";
			loading.textContent = err.message || "오류가 발생했습니다.";
		}
	}

	function setupEvents() {
		document.querySelectorAll(".nav-bar button").forEach((b) => {
			b.addEventListener("click", (e) => switchPage(e.currentTarget.dataset.page));
		});
		applyHash();
		window.addEventListener("hashchange", applyHash);

		$id("searchInput")?.addEventListener("input", (e) => {
			state.query = e.target.value;
			renderNotices();
		});
		document.addEventListener("click", handleDocumentClick);
		document.addEventListener("keydown", handleNoticeKeydown);
		document.addEventListener("keydown", handleEscapeKey);

		setupWeekControls();
		setupMealDateControls();
		setupModalControls();

		$id("taskForm")?.addEventListener("submit", handleTaskSubmit);
		$id("classForm")?.addEventListener("submit", handleClassSubmit);
		$id("authForm")?.addEventListener("submit", handleAuthSubmit);
		$id("aiFab")?.addEventListener("click", () => toggleAiPanel());
		$id("aiPanelClose")?.addEventListener("click", () => toggleAiPanel(false));
		$id("aiForm")?.addEventListener("submit", handleAiSubmit);
	}

	async function init() {
		renderAuthUI();
		renderChips();
		setupEvents();
		await refreshSession();
		await Promise.all([loadNotices(), loadRestaurants(), loadClasses(), loadTasks()]);
		renderAll();
	}

	init();
})();
