# CampusLens — Ollama 자연어 질의 기능 설계

- 날짜: 2026-05-29
- 상태: 승인됨 (구현 대기)
- 작성: brainstorming 세션

## 1. 목적

CampusLens 공개 데이터(공지, 식당)에 대해 사용자가 자연어로 질문하면,
로컬 LLM(Ollama)이 의도를 파악해 **관련 항목을 필터링**하고 **자연어 답변**을
근거 카드와 함께 돌려준다. 기존 키워드 `includes` 검색을 보완한다.

예: "다음주 마감인 장학 공지 보여줘" → 장학 카테고리 + 마감 7일 이내 공지 필터 +
"3건 있습니다. 국가근로..." 형태 답변 + 공지 카드.

## 2. 범위

### 포함
- 데이터 대상: `notices.json`, `restaurants.json` (공개 데이터, 인증 불필요)
- 동작: 필터링 + 자연어 답변 (방식 A, 2단계 RAG)
- UI: 플로팅 챗 위젯(우측 하단 버튼 → 패널), 전 페이지 접근

### 제외 (YAGNI)
- 스트리밍 답변 → 향후(v2)
- 멀티턴 대화 히스토리 → 단일 질의만
- tasks/classes(개인 데이터) 및 인증 연동
- 벡터 DB / 임베딩 — 데이터 작음(~24KB), 프롬프트로 충분

## 3. 아키텍처

선택 방식: **A — 2단계 RAG**. 데이터 필터링은 코드가 결정적으로 수행해
환각을 차단하고 카드를 실제 데이터로 보장한다. LLM은 (1) 의도→필터스펙 추출,
(2) 후보→자연어 답변 두 가지에만 쓴다.

### 신규/수정 파일

```
backend/
  ai/
    query.js          # POST /api/ai/query 핸들러 (공개, 인증 X)
    ollamaClient.js   # Ollama REST 호출 래퍼 (/api/chat)
    filter.js         # 필터 스펙 → 공지/식당 후보 (순수함수)
    prompts.js        # 1단계/2단계 프롬프트 빌더
    filter.test.js    # node:test 단위 테스트 (필터 로직)
  index.js            # 라우트 등록 1줄 추가
frontend/
  index.html          # 플로팅 버튼 + 패널 마크업/스타일 추가
  script.js           # 위젯 로직 추가
```

기존 패턴 준수: 백엔드는 ESM, 핸들러는 `(req, res, next)` 시그니처
(예: `backend/public-data/notices.js`), 데이터 읽기는 `services/fileStore.js`의
`readJson(NOTICES_FILE/RESTAURANTS_FILE)`. 프론트는 바닐라 JS + `state` 객체 +
`fetch(API_BASE + path)` 패턴.

## 4. 데이터 흐름

```
프론트 위젯 → POST /api/ai/query { question: string }
  ↓ 백엔드 query.js
[호출①] ollamaClient.chat(format:"json", 필터추출 프롬프트)
        → 필터스펙 JSON
  ↓
filter.js: notices + restaurants 읽어 코드로 필터 → 후보 ≤ 8개
  ↓
후보 0건 → 호출② 생략, 고정 답변("관련 항목 못 찾음")
후보 ≥1건 → [호출②] ollamaClient.chat(후보+질문, 답변생성 프롬프트)
        → 한국어 평문 답변
  ↓
응답 { answer, sources: [카드], filter: {...디버그} }
  ↓
프론트: 답변 말풍선 + 근거 카드(클릭 → notice.url / 식당 정보)
```

## 5. API 계약

`POST /api/ai/query` (인증 불필요)

요청:
```json
{ "question": "다음주 마감인 장학 공지 보여줘" }
```

성공 200:
```json
{
  "answer": "장학 카테고리에서 마감이 7일 이내인 공지 2건이 있습니다. ...",
  "sources": [
    { "type": "notice", "id": "notice_624098", "title": "...",
      "dept": "장학지원팀", "date": "2026-05-27",
      "deadline": null, "url": "https://..." }
  ],
  "filter": { "dataset": "notices", "category": "장학",
              "keywords": [], "urgent": null, "deadlineWithinDays": 7 }
}
```

식당 source:
```json
{ "type": "restaurant", "id": "core", "name": "감성코어",
  "desc": "제3복지관 1층", "icon": "🍽️" }
```
(restaurants.json 스키마: `{ id, name, desc(위치), icon, gradient,
weeklyMeals:{ "0".."6":[{ type, menu, desc, time }] } }`)

에러:
- 400 `{ error:"BAD_REQUEST", message:"질문이 비어 있습니다." }` — question 없음/빈 문자열
- 503 `{ error:"OLLAMA_UNAVAILABLE", message:"AI 서버(Ollama)에 연결할 수 없습니다. 'ollama serve' 실행과 모델 pull이 필요합니다." }`
- 500 `{ error:"SERVER_ERROR", message:"..." }` — 기타

## 6. 필터 스펙 스키마 (호출① 출력)

```json
{
  "dataset": "notices | restaurants | both",
  "category": "공지 카테고리 문자열 | null",
  "keywords": ["문자열", "..."],
  "urgent": "true | false | null",
  "deadlineWithinDays": "정수 | null"
}
```

- 카테고리 후보는 프론트 `NOTICE_CATEGORIES`와 일치시킨다(프롬프트에 목록 명시).
- 호출① system 프롬프트에 **서버 오늘 날짜**(`new Date()`)를 주입해 "다음주/이번주/
  N일 이내" 등 상대 표현을 `deadlineWithinDays`로 환산하게 한다.
- `format:"json"` 옵션으로 JSON 강제. 파싱 실패 시 빈 스펙(전체 검색)으로 폴백.

## 7. filter.js 로직 (순수함수)

입력: `(filterSpec, notices, restaurants, today)` → 출력: `sources[]` (≤8).

- dataset === "restaurants" → 식당만, "both" → 둘 다, 그 외 → 공지.
- notices 필터: category 일치(있을 때) AND urgent 일치(있을 때) AND
  deadline ≤ today+N일(deadlineWithinDays 있을 때, deadline null은 제외) AND
  keyword가 title/summary/tags 중 하나라도 매칭(keywords 있을 때).
- restaurants 필터: keyword를 name/desc/weeklyMeals의 menu에 매칭(없으면 전체 상위 N).
- 점수: 매칭 키워드 수 + urgent 가중치. 내림차순 정렬 후 상위 8.
- 순수함수 → LLM/네트워크 없이 단위 테스트.

## 8. prompts.js

- `buildFilterPrompt(question, today, categories)` → 호출① messages.
  system: 역할 + 스키마 + 카테고리 목록 + 오늘 날짜 + "JSON만 출력".
- `buildAnswerPrompt(question, candidates)` → 호출② messages.
  system: "주어진 항목만 근거로 간결한 한국어 답변. 없는 내용 지어내지 말 것."
  user: 질문 + 후보 요약 목록(공지: title/dept/date/deadline/summary,
  식당: 핵심 필드).

## 9. ollamaClient.js

- `chat({ messages, format })` → `fetch(`${OLLAMA_URL}/api/chat`)`,
  body `{ model: OLLAMA_MODEL, messages, stream:false, format }`.
- `AbortController`로 30초 타임아웃.
- 연결 실패(ECONNREFUSED)/타임아웃 → `OllamaUnavailableError` throw → 핸들러가 503 매핑.

## 10. 설정 (env)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `qwen2.5:7b` | 사용 모델(한국어+JSON 안정) |

## 11. 프론트엔드 위젯

- 우측 하단 플로팅 버튼(💬). 클릭 → 패널 토글.
- 패널: 메시지 목록(사용자/AI 말풍선) + 입력창 + 전송 버튼.
- 전송 → `POST /api/ai/query` → 로딩 표시 → 답변 말풍선 + 근거 카드 렌더.
- 카드: 공지는 기존 공지 카드 스타일 재사용(클릭 시 `notice.url` 새 탭),
  식당은 간단 카드.
- 에러 응답 → 빨간 에러 말풍선.
- 스타일: index.html 내 기존 CSS 변수/클래스 패턴 따름. 신규 클래스 접두사 `ai-`.

## 12. 에러 / 엣지 케이스

- 빈 질문 → 400, 프론트에서 전송 차단.
- Ollama 미실행 → 503 + 안내 말풍선.
- 호출① JSON 파싱 실패 → 빈 필터(전체 대상)로 진행.
- 후보 0건 → 호출② 생략, "관련 공지/식당을 찾지 못했습니다." 답변.
- 호출② 타임아웃 → 503.

## 13. 테스트

- `backend/ai/filter.test.js` (node:test): 카테고리/urgent/deadline/keyword
  조합, 0건, 상위 N 제한 케이스 검증. 픽스처는 작은 인라인 배열.
- `package.json`에 `"test": "node --test"` 스크립트 추가.
- Ollama 연동(호출①②)은 수동 확인: `ollama serve` + 모델 pull 후 질의.

## 14. 미해결 / 구현 시 확인

- 모델 한국어 JSON 출력 품질 → 필요 시 프롬프트 few-shot 보강.
