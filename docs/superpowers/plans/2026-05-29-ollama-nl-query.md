# Ollama 자연어 질의 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CampusLens 공개 데이터(공지/식당)에 대해 로컬 Ollama로 자연어 질의 → 코드 필터링 + 자연어 답변 + 근거 카드를 플로팅 챗 위젯으로 제공한다.

**Architecture:** 방식 A(2단계 RAG). 호출①에서 LLM이 질문→필터스펙(JSON) 추출, 백엔드가 코드로 결정적 필터링, 호출②에서 LLM이 후보 기반 한국어 답변 생성. 데이터 필터는 순수함수로 분리해 단위 테스트.

**Tech Stack:** Node ESM(Express), 바닐라 JS 프론트, Ollama `/api/chat` REST, `node:test`.

설계 스펙: `docs/superpowers/specs/2026-05-29-ollama-nl-query-design.md`

---

## File Structure

- `backend/ai/filter.js` (생성) — 필터스펙→후보 순수함수
- `backend/ai/filter.test.js` (생성) — filter.js 단위 테스트
- `backend/ai/prompts.js` (생성) — 호출①/② 프롬프트 빌더
- `backend/ai/prompts.test.js` (생성) — prompts.js 단위 테스트
- `backend/ai/ollamaClient.js` (생성) — Ollama REST 래퍼 + 타임아웃/에러
- `backend/ai/query.js` (생성) — `POST /api/ai/query` 핸들러
- `backend/index.js` (수정) — 라우트 등록
- `backend/package.json` (수정) — `test` 스크립트
- `frontend/index.html` (수정) — 플로팅 버튼 + 패널 마크업
- `frontend/style.css` (수정) — `ai-` 위젯 스타일
- `frontend/script.js` (수정) — 위젯 로직 + 이벤트 배선

---

## Task 1: filter.js — 필터 순수함수 (TDD)

**Files:**
- Create: `backend/ai/filter.js`
- Test: `backend/ai/filter.test.js`
- Modify: `backend/package.json`

- [ ] **Step 1: package.json에 test 스크립트 추가**

`backend/package.json`의 `scripts`를 다음으로 교체:

```json
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "crawl": "node script_crawler/crawler.js",
    "test": "node --test"
  },
```

- [ ] **Step 2: 실패 테스트 작성**

`backend/ai/filter.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterSources } from "./filter.js";

const TODAY = new Date("2026-05-29T00:00:00");

const NOTICES = [
  { id: "n1", title: "국가근로 장학 신청", category: "장학", dept: "장학지원팀",
    date: "2026-05-27", deadline: "2026-06-02", url: "http://x/1",
    summary: "국가근로 신청 안내", tags: ["국가근로", "장학금"], urgent: true },
  { id: "n2", title: "에볼라 예방수칙 안내", category: "기타", dept: "건강증진센터",
    date: "2026-05-20", deadline: null, url: "http://x/2",
    summary: "감염 예방", tags: ["건강"], urgent: false },
  { id: "n3", title: "취업 박람회", category: "취업", dept: "취업지원팀",
    date: "2026-05-15", deadline: "2026-08-01", url: "http://x/3",
    summary: "기업 부스", tags: ["취업", "박람회"], urgent: false },
];

const RESTAURANTS = [
  { id: "core", name: "감성코어", desc: "제3복지관 1층", icon: "🍽️",
    weeklyMeals: { "1": [{ type: "점심", menu: "치킨 마요덮밥", desc: "샐러드", time: "11:00" }] } },
  { id: "dream", name: "드림타워", desc: "드림타워 지하", icon: "🍱",
    weeklyMeals: { "1": [{ type: "점심", menu: "돈까스", desc: "카레", time: "11:00" }] } },
];

test("category 필터로 장학 공지만 반환", () => {
  const out = filterSources({ dataset: "notices", category: "장학" }, NOTICES, RESTAURANTS, TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "n1");
  assert.equal(out[0].type, "notice");
});

test("deadlineWithinDays로 마감 임박만 반환", () => {
  const out = filterSources({ dataset: "notices", deadlineWithinDays: 7 }, NOTICES, RESTAURANTS, TODAY);
  const ids = out.map((s) => s.id);
  assert.deepEqual(ids, ["n1"]); // 06-02만 7일 이내, deadline null/08-01 제외
});

test("keyword 매칭 + 점수 정렬", () => {
  const out = filterSources({ dataset: "notices", keywords: ["취업"] }, NOTICES, RESTAURANTS, TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "n3");
});

test("dataset both는 공지+식당 모두 후보", () => {
  const out = filterSources({ dataset: "both", keywords: ["덮밥"] }, NOTICES, RESTAURANTS, TODAY);
  assert.ok(out.some((s) => s.type === "restaurant" && s.id === "core"));
});

test("restaurants는 메뉴 텍스트로 매칭", () => {
  const out = filterSources({ dataset: "restaurants", keywords: ["돈까스"] }, NOTICES, RESTAURANTS, TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "드림타워");
});

test("결과 없으면 빈 배열", () => {
  const out = filterSources({ dataset: "notices", keywords: ["존재안함XYZ"] }, NOTICES, RESTAURANTS, TODAY);
  assert.deepEqual(out, []);
});

test("source는 최소 필드만 포함", () => {
  const out = filterSources({ dataset: "notices", category: "장학" }, NOTICES, RESTAURANTS, TODAY);
  assert.deepEqual(Object.keys(out[0]).sort(),
    ["date", "deadline", "dept", "id", "title", "type", "url"].sort());
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `npm --prefix backend test`
Expected: FAIL — `Cannot find module './filter.js'` (또는 filterSources undefined)

- [ ] **Step 4: filter.js 구현**

`backend/ai/filter.js`:

```js
const MAX_RESULTS = 8;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function noticeMatches(notice, spec, today) {
  if (spec.category && spec.category !== "전체" && notice.category !== spec.category) return false;
  if (spec.urgent === true && !notice.urgent) return false;
  if (spec.urgent === false && notice.urgent) return false;
  if (typeof spec.deadlineWithinDays === "number") {
    if (!notice.deadline) return false;
    const dl = startOfDay(notice.deadline);
    if (Number.isNaN(dl.getTime())) return false;
    const from = startOfDay(today);
    const to = startOfDay(today);
    to.setDate(to.getDate() + spec.deadlineWithinDays);
    if (dl < from || dl > to) return false;
  }
  return true;
}

function keywordScore(text, keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (kw && lower.includes(String(kw).toLowerCase())) score += 1;
  }
  return score;
}

function noticeSource(n) {
  return { type: "notice", id: n.id, title: n.title, dept: n.dept,
    date: n.date, deadline: n.deadline, url: n.url };
}

function restaurantSource(r) {
  return { type: "restaurant", id: r.id, name: r.name, desc: r.desc, icon: r.icon };
}

export function filterSources(spec = {}, notices = [], restaurants = [], today = new Date()) {
  const dataset = spec.dataset === "restaurants" ? "restaurants"
    : spec.dataset === "both" ? "both" : "notices";
  const hasKw = Array.isArray(spec.keywords) && spec.keywords.length > 0;
  const scored = [];

  if (dataset === "notices" || dataset === "both") {
    for (const n of notices) {
      if (!noticeMatches(n, spec, today)) continue;
      const text = [n.title, n.summary, (n.tags || []).join(" ")].join(" ");
      const score = keywordScore(text, spec.keywords);
      if (hasKw && score === 0) continue;
      scored.push({ score: score + (n.urgent ? 0.5 : 0), src: noticeSource(n) });
    }
  }

  if (dataset === "restaurants" || dataset === "both") {
    for (const r of restaurants) {
      const menus = Object.values(r.weeklyMeals || {}).flat()
        .map((m) => `${m.menu || ""} ${m.desc || ""}`).join(" ");
      const text = [r.name, r.desc, menus].join(" ");
      const score = keywordScore(text, spec.keywords);
      if (hasKw && score === 0) continue;
      scored.push({ score, src: restaurantSource(r) });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS).map((s) => s.src);
}
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `npm --prefix backend test`
Expected: PASS — 7 tests passing

- [ ] **Step 6: 커밋**

```bash
git add backend/ai/filter.js backend/ai/filter.test.js backend/package.json
git commit -m "feat(ai): add deterministic source filter for NL query"
```

---

## Task 2: prompts.js — 프롬프트 빌더 (TDD)

**Files:**
- Create: `backend/ai/prompts.js`
- Test: `backend/ai/prompts.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`backend/ai/prompts.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFilterPrompt, buildAnswerPrompt } from "./prompts.js";

test("buildFilterPrompt는 system+user 메시지, 날짜/카테고리 포함", () => {
  const today = new Date("2026-05-29T00:00:00");
  const msgs = buildFilterPrompt("장학 공지 보여줘", today, ["학사", "장학"]);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.equal(msgs[1].role, "user");
  assert.equal(msgs[1].content, "장학 공지 보여줘");
  assert.ok(msgs[0].content.includes("2026-05-29"));
  assert.ok(msgs[0].content.includes("장학"));
});

test("buildAnswerPrompt는 후보를 user 메시지에 나열", () => {
  const sources = [
    { type: "notice", title: "국가근로 장학", dept: "장학팀", date: "2026-05-27", deadline: "2026-06-02" },
    { type: "restaurant", name: "감성코어", desc: "제3복지관 1층" },
  ];
  const msgs = buildAnswerPrompt("뭐 있어?", sources);
  assert.equal(msgs.length, 2);
  assert.ok(msgs[1].content.includes("국가근로 장학"));
  assert.ok(msgs[1].content.includes("감성코어"));
  assert.ok(msgs[1].content.includes("뭐 있어?"));
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm --prefix backend test`
Expected: FAIL — `Cannot find module './prompts.js'`

- [ ] **Step 3: prompts.js 구현**

`backend/ai/prompts.js`:

```js
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildFilterPrompt(question, today, categories) {
  const todayStr = toLocalDateStr(today);
  const system = `너는 대학 캠퍼스 앱의 질의 분석기다. 사용자의 한국어 질문을 읽고 검색 필터를 JSON으로만 출력한다.
오늘 날짜: ${todayStr}
공지 카테고리 목록: ${categories.join(", ")}
출력 스키마:
{
  "dataset": "notices" | "restaurants" | "both",
  "category": <위 목록 중 하나 또는 null>,
  "keywords": [<핵심 키워드 문자열>],
  "urgent": true | false | null,
  "deadlineWithinDays": <정수 또는 null>
}
규칙:
- 식당/학식/메뉴 관련이면 dataset에 restaurants, 공지/장학/학사/대회 등이면 notices, 둘 다면 both.
- "이번주"는 7, "다음주"는 7, "마감 임박"은 7처럼 상대 기간은 deadlineWithinDays(정수)로 환산.
- 해당 없는 필드는 null, 키워드 없으면 빈 배열.
- JSON 외 다른 텍스트는 절대 출력하지 말 것.`;
  return [
    { role: "system", content: system },
    { role: "user", content: question },
  ];
}

function formatCandidate(s, i) {
  if (s.type === "notice") {
    const meta = [s.dept, s.date && `등록 ${s.date}`, s.deadline && `마감 ${s.deadline}`]
      .filter(Boolean).join(", ");
    return `${i + 1}. [공지] ${s.title} (${meta})`;
  }
  return `${i + 1}. [식당] ${s.name} - ${s.desc || ""}`;
}

export function buildAnswerPrompt(question, sources) {
  const list = sources.map(formatCandidate).join("\n");
  const system = `너는 대학 캠퍼스 앱의 도우미다. 아래 "검색 결과"에 있는 항목만 근거로 한국어로 간결하게 답한다.
검색 결과에 없는 내용은 지어내지 말 것. 핵심만 2~4문장으로 요약한다.`;
  const user = `질문: ${question}\n\n검색 결과:\n${list}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm --prefix backend test`
Expected: PASS — 모든 테스트 통과(filter + prompts)

- [ ] **Step 5: 커밋**

```bash
git add backend/ai/prompts.js backend/ai/prompts.test.js
git commit -m "feat(ai): add filter/answer prompt builders"
```

---

## Task 3: ollamaClient.js — Ollama REST 래퍼

**Files:**
- Create: `backend/ai/ollamaClient.js`

테스트 없음(네트워크 의존). Task 7에서 수동 검증.

- [ ] **Step 1: ollamaClient.js 구현**

`backend/ai/ollamaClient.js`:

```js
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const TIMEOUT_MS = 30000;

export class OllamaUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

export async function chat({ messages, format }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        ...(format ? { format } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new OllamaUnavailableError(`Ollama 응답 오류 (${res.status})`);
    }
    const data = await res.json();
    return data?.message?.content ?? "";
  } catch (err) {
    if (err instanceof OllamaUnavailableError) throw err;
    if (err.name === "AbortError") {
      throw new OllamaUnavailableError("Ollama 응답 시간이 초과되었습니다.");
    }
    throw new OllamaUnavailableError(`Ollama 연결에 실패했습니다: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: 구문 검사**

Run: `node --check backend/ai/ollamaClient.js`
Expected: 출력 없음(통과)

- [ ] **Step 3: 커밋**

```bash
git add backend/ai/ollamaClient.js
git commit -m "feat(ai): add Ollama chat client with timeout + error type"
```

---

## Task 4: query.js 핸들러 + 라우트 등록

**Files:**
- Create: `backend/ai/query.js`
- Modify: `backend/index.js`

- [ ] **Step 1: query.js 구현**

`backend/ai/query.js`:

```js
import { readJson, NOTICES_FILE, RESTAURANTS_FILE } from "../services/fileStore.js";
import { chat, OllamaUnavailableError } from "./ollamaClient.js";
import { filterSources } from "./filter.js";
import { buildFilterPrompt, buildAnswerPrompt } from "./prompts.js";

const NOTICE_CATEGORIES = ["학사", "장학", "취업", "행사", "기타"];

function unavailable(res, message) {
  return res.status(503).json({ error: "OLLAMA_UNAVAILABLE", message });
}

export default async function aiQuery(req, res, next) {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "질문이 비어 있습니다." });
    }

    const today = new Date();

    // 호출① — 필터스펙 추출
    let spec = {};
    try {
      const raw = await chat({
        messages: buildFilterPrompt(question, today, NOTICE_CATEGORIES),
        format: "json",
      });
      spec = JSON.parse(raw);
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        return unavailable(res, `${err.message} 'ollama serve' 실행과 모델 pull이 필요합니다.`);
      }
      spec = {}; // JSON 파싱 실패 → 전체 검색으로 폴백
    }

    const [notices, restaurants] = await Promise.all([
      readJson(NOTICES_FILE, []),
      readJson(RESTAURANTS_FILE, []),
    ]);

    const sources = filterSources(spec, notices, restaurants, today);

    if (sources.length === 0) {
      return res.json({
        answer: "관련 공지나 식당 정보를 찾지 못했습니다.",
        sources: [],
        filter: spec,
      });
    }

    // 호출② — 자연어 답변
    let answer;
    try {
      answer = await chat({ messages: buildAnswerPrompt(question, sources) });
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        return unavailable(res, err.message);
      }
      throw err;
    }

    res.json({ answer: answer.trim(), sources, filter: spec });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 2: index.js에 import 추가**

`backend/index.js`의 import 블록, `import restaurants ...` 줄 바로 다음에 추가:

```js
import aiQuery from "./ai/query.js";
```

- [ ] **Step 3: index.js에 라우트 등록**

`backend/index.js`의 public-data 라우트 블록 바로 다음(`app.get("/api/public-data/restaurants", restaurants);` 줄 뒤)에 추가:

```js
app.post("/api/ai/query", aiQuery);
```

- [ ] **Step 4: 구문 검사 + 서버 부팅 확인**

Run: `node --check backend/ai/query.js`
Expected: 출력 없음(통과)

Run (별도 터미널 또는 백그라운드): `npm --prefix backend start`
Expected: 콘솔에 `CampusLens backend listening on http://127.0.0.1:3001`. 확인 후 종료.

- [ ] **Step 5: 빈 질문 검증 (Ollama 불필요)**

서버 실행 중 상태에서:

Run: `curl -s -X POST http://127.0.0.1:3001/api/ai/query -H "Content-Type: application/json" -d "{}"`
Expected: `{"error":"BAD_REQUEST","message":"질문이 비어 있습니다."}`

- [ ] **Step 6: 커밋**

```bash
git add backend/ai/query.js backend/index.js
git commit -m "feat(ai): add /api/ai/query 2-stage RAG handler"
```

---

## Task 5: 프론트엔드 위젯 마크업 + 스타일

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`

- [ ] **Step 1: index.html에 위젯 마크업 추가**

`frontend/index.html`에서 `<div class="toast" id="toast" ...>` 줄 **바로 앞**에 추가:

```html
			<button class="ai-fab" id="aiFab" type="button" aria-label="AI 도우미 열기">💬</button>
			<div class="ai-panel" id="aiPanel" data-component="ai-panel" hidden>
				<div class="ai-panel-head">
					<strong>AI 캠퍼스 도우미</strong>
					<button class="ai-panel-close" id="aiPanelClose" type="button" aria-label="닫기">✕</button>
				</div>
				<div class="ai-messages" id="aiMessages" data-render-target="ai-messages"></div>
				<form class="ai-input-row" id="aiForm">
					<input id="aiInput" type="text" placeholder="예: 다음주 마감인 장학 공지 알려줘" autocomplete="off" />
					<button class="ai-send" type="submit" aria-label="보내기">↑</button>
				</form>
			</div>
```

- [ ] **Step 2: style.css에 위젯 스타일 추가**

`frontend/style.css` 맨 끝에 추가:

```css
.ai-fab {
	position: fixed;
	right: 20px;
	bottom: 20px;
	width: 56px;
	height: 56px;
	border-radius: 50%;
	border: none;
	background: var(--primary);
	color: #fff;
	font-size: 24px;
	cursor: pointer;
	box-shadow: var(--shadow);
	z-index: 60;
}

.ai-panel {
	position: fixed;
	right: 20px;
	bottom: 88px;
	width: min(380px, calc(100vw - 40px));
	height: min(520px, calc(100vh - 140px));
	background: var(--paper-solid);
	border: 1px solid var(--line);
	border-radius: 18px;
	box-shadow: var(--shadow);
	display: flex;
	flex-direction: column;
	overflow: hidden;
	z-index: 60;
}

.ai-panel[hidden] {
	display: none;
}

.ai-panel-head {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 14px 16px;
	border-bottom: 1px solid var(--line);
	color: var(--ink);
}

.ai-panel-close {
	border: none;
	background: transparent;
	font-size: 16px;
	cursor: pointer;
	color: var(--muted);
}

.ai-messages {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.ai-msg {
	max-width: 85%;
	padding: 10px 12px;
	border-radius: 14px;
	font-size: 14px;
	line-height: 1.5;
	white-space: pre-wrap;
}

.ai-msg.user {
	align-self: flex-end;
	background: var(--primary);
	color: #fff;
}

.ai-msg.bot {
	align-self: flex-start;
	background: var(--bg);
	color: var(--ink);
}

.ai-msg.error {
	align-self: flex-start;
	background: rgba(249, 115, 22, 0.15);
	color: var(--orange);
}

.ai-sources {
	display: flex;
	flex-direction: column;
	gap: 8px;
	align-self: flex-start;
	max-width: 95%;
}

.ai-source-card {
	display: block;
	padding: 10px 12px;
	border: 1px solid var(--line);
	border-radius: 12px;
	background: var(--paper-solid);
	color: var(--ink);
	text-decoration: none;
	font-size: 13px;
}

.ai-source-card small {
	color: var(--muted);
	display: block;
	margin-top: 2px;
}

.ai-input-row {
	display: flex;
	gap: 8px;
	padding: 12px;
	border-top: 1px solid var(--line);
}

.ai-input-row input {
	flex: 1;
	padding: 10px 12px;
	border: 1px solid var(--line);
	border-radius: 12px;
	background: var(--paper-solid);
	color: var(--ink);
}

.ai-send {
	border: none;
	background: var(--primary);
	color: #fff;
	width: 40px;
	border-radius: 12px;
	cursor: pointer;
	font-size: 16px;
}
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/index.html frontend/style.css
git commit -m "feat(ai): add floating AI widget markup + styles"
```

---

## Task 6: 프론트엔드 위젯 로직 + 이벤트 배선

**Files:**
- Modify: `frontend/script.js`

- [ ] **Step 1: 위젯 함수 추가**

`frontend/script.js`에서 `function setupEvents() {` 정의 **바로 앞**에 추가:

```js
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
		const question = input.value.trim();
		if (!question) return;
		appendAiMessage("user", question);
		input.value = "";
		const loading = appendAiMessage("bot", "생각 중…");
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
```

- [ ] **Step 2: setupEvents에 배선 추가**

`frontend/script.js`의 `setupEvents` 함수 안, `$id("authForm")?.addEventListener("submit", handleAuthSubmit);` 줄 **바로 다음**에 추가:

```js
		$id("aiFab")?.addEventListener("click", () => toggleAiPanel());
		$id("aiPanelClose")?.addEventListener("click", () => toggleAiPanel(false));
		$id("aiForm")?.addEventListener("submit", handleAiSubmit);
```

- [ ] **Step 3: 구문 검사**

Run: `node --check frontend/script.js`
Expected: 출력 없음(통과)

- [ ] **Step 4: 커밋**

```bash
git add frontend/script.js
git commit -m "feat(ai): wire floating AI widget logic"
```

---

## Task 7: 엔드투엔드 수동 검증 (Ollama 필요)

**Files:** 없음(검증만)

- [ ] **Step 1: Ollama 준비**

Run: `ollama --version` (미설치면 https://ollama.com 설치)
Run: `ollama pull qwen2.5:7b`
Run: `ollama serve` (이미 떠 있으면 생략)

- [ ] **Step 2: 백엔드 실행**

Run: `npm --prefix backend start`
Expected: `CampusLens backend listening on http://127.0.0.1:3001`

- [ ] **Step 3: API 직접 질의**

Run:
```bash
curl -s -X POST http://127.0.0.1:3001/api/ai/query -H "Content-Type: application/json" -d "{\"question\":\"장학 공지 알려줘\"}"
```
Expected: `answer`(한국어 문장), `sources`(공지 카드 배열, 장학 카테고리), `filter` 포함된 JSON.

- [ ] **Step 4: Ollama 미실행 시 503 확인**

`ollama serve` 종료 후 Step 3 재실행.
Expected: `{"error":"OLLAMA_UNAVAILABLE","message":"..."}` (HTTP 503)

- [ ] **Step 5: 브라우저 위젯 확인**

브라우저에서 `http://127.0.0.1:3001` 열기 → 우측 하단 💬 클릭 → 패널 열림 →
"다음주 마감인 장학 공지" 입력 → 답변 말풍선 + 근거 카드 표시, 카드 클릭 시 원문 새 탭.

- [ ] **Step 6: 단위 테스트 최종 실행**

Run: `npm --prefix backend test`
Expected: 모든 테스트 PASS

---

## 완료 기준

- [ ] `npm --prefix backend test` 전부 통과
- [ ] `POST /api/ai/query`가 answer + sources + filter 반환
- [ ] Ollama 미실행 시 503 + 안내 메시지
- [ ] 위젯에서 질의 → 답변 + 클릭 가능한 근거 카드
