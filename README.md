# CampusLens

CampusLens는 교내 공지, 학식, 시간표, 과제 일정을 한 화면에서 관리하는 학생용 웹 애플리케이션입니다. 프론트엔드(정적 HTML/CSS/JS)와 백엔드(Express + JSON 파일 저장소)가 완전히 분리된 학부 과제용 프로토타입 구조입니다.

## 주요 기능

- 교내 공지/대회 목록 조회, 검색, 카테고리 필터
- 공지 카드 클릭 시 상세 모달 표시
- 식당별 주간 학식 조회 및 날짜 이동
- 개인 시간표 강의 추가/삭제, 주차 이동
- 과제·시험·발표 일정 CRUD
- 회원가입 / 로그인 / 로그아웃 (세션 쿠키 기반)
- 경기대 컴퓨터공학전공 공지 크롤러 + Ollama 기반 정규화 (실패 시 규칙 기반 fallback)

## 기술 스택

- Frontend: HTML, CSS, Vanilla JavaScript (index.html, script.js, style.css 세 파일)
- Backend: Node.js 18+, Express 4
- Data Store: 사용자별 JSON 파일 (`backend/data/`)
- Crawler: Cheerio
- LLM 정규화: Ollama (`gemma-4-e4b`)
- Auth: scrypt 비밀번호 해시 + HttpOnly 세션 쿠키

## 프로젝트 구조

```text
CampusLens/
├─ README.md
├─ frontend/
│  ├─ index.html
│  ├─ script.js
│  ├─ style.css
│  └─ campuslens-header-icon.svg
└─ backend/
   ├─ index.js
   ├─ package.json
   ├─ ollama_config.json
   ├─ auth/
   │  ├─ login.js
   │  ├─ logout.js
   │  ├─ signup.js
   │  └─ me.js
   ├─ public-data/
   │  ├─ notices.js
   │  └─ restaurants.js
   ├─ tasks/
   │  ├─ getAll.js
   │  ├─ create.js
   │  ├─ getOne.js
   │  ├─ update.js
   │  └─ remove.js
   ├─ classes/
   │  ├─ getAll.js
   │  ├─ create.js
   │  ├─ update.js
   │  └─ remove.js
   ├─ middleware/
   │  └─ requireAuth.js
   ├─ services/
   │  ├─ fileStore.js
   │  ├─ sessionStore.js
   │  ├─ userStore.js
   │  └─ seed.js
   ├─ script_crawler/
   │  └─ crawler.js
   └─ data/                       # 첫 실행 시 자동 생성
      ├─ session.json
      ├─ public/
      │  ├─ notices.json
      │  └─ restaurants.json
      └─ user/
         └─ {user_id}/
            ├─ info.json
            ├─ tasks.json
            └─ classes.json
```

## 빠른 시작 (Quick Start)

```powershell
cd backend
npm install
npm start
```

브라우저에서 다음 주소를 엽니다.

```
http://127.0.0.1:3001
```

- 백엔드는 `http://127.0.0.1:3001` 에서 API를 제공하고, 동시에 `frontend/` 폴더를 정적으로 서빙합니다.
- 첫 실행 시 `backend/data/` 폴더와 더미 공지·학식 데이터, 데모 사용자가 자동으로 생성되므로 로그인 없이도 공지·학식 데이터가 바로 보입니다.

## 테스트 계정

서버를 처음 실행하면 다음 계정이 자동으로 생성됩니다.

| 이메일 | 비밀번호 | 이름 |
|---|---|---|
| `student@campuslens.dev` | `campus123` | 데모학생 |

이 계정에는 데모용 시간표 5개와 과제 일정 3개가 미리 저장되어 있어, 로그인 직후 시간표와 일정이 채워진 상태를 확인할 수 있습니다.

## API 엔드포인트

모든 API의 base URL 은 `http://127.0.0.1:3001` 입니다.

### Health

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/health` | 서버 상태 확인 |

### Auth

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/auth/signup` | 회원가입 후 세션 쿠키 발급 |
| `POST` | `/api/auth/login` | 로그인 후 세션 쿠키 발급 |
| `POST` | `/api/auth/logout` | 현재 세션 삭제 |
| `GET` | `/api/auth/me` | 현재 로그인 사용자 조회 |

### Public Data

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/public-data/notices` | 공개 공지 목록 |
| `GET` | `/api/public-data/restaurants` | 식당별 주간 학식 |

### Tasks (로그인 필요)

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/tasks` | 내 일정 목록 |
| `POST` | `/api/tasks` | 일정 생성 |
| `GET` | `/api/tasks/:id` | 단일 일정 조회 |
| `PATCH` | `/api/tasks/:id` | 일정 수정 |
| `DELETE` | `/api/tasks/:id` | 일정 삭제 |

### Classes (로그인 필요)

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/classes` | 내 강의 목록 |
| `POST` | `/api/classes` | 강의 생성 |
| `PATCH` | `/api/classes/:id` | 강의 수정 |
| `DELETE` | `/api/classes/:id` | 강의 삭제 |

## 데이터 저장 구조

- `backend/data/session.json` — 활성 세션 배열
- `backend/data/public/notices.json` — 공개 공지 목록
- `backend/data/public/restaurants.json` — 학식 데이터
- `backend/data/user/{user_id}/info.json` — 사용자 계정 정보 (해시된 비밀번호 포함)
- `backend/data/user/{user_id}/tasks.json` — 사용자 일정
- `backend/data/user/{user_id}/classes.json` — 사용자 강의 (시간표)

서버는 시작 시 위 파일·폴더가 없으면 자동으로 더미 데이터를 채워 생성합니다.

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `HOST` | `127.0.0.1` | 바인딩 주소 |
| `PORT` | `3001` | 서버 포트 |

```powershell
$env:PORT="3002"; npm start
```

## 공지 크롤러

대상: `https://www.kyonggi.ac.kr/u_computer/selectBbsNttList.do?key=8824&bbsNo=1073` (경기대 컴퓨터공학전공 공지사항)

```powershell
cd backend
npm run crawl                       # 1페이지, Ollama + fallback
npm run crawl -- --pages 3          # 3페이지까지 순회
npm run crawl -- --no-ollama        # Ollama 없이 fallback 만 사용
npm run crawl -- --limit 10         # 상세 페이지 10개로 제한
```

옵션:

| 옵션 | 설명 |
|---|---|
| `--pages <n>` | 순회할 pageIndex 수 (기본 1) |
| `--limit <n>` | 상세 페이지 수집 상한 (0 = 무제한) |
| `--no-ollama` | Ollama 호출 없이 규칙 기반 fallback 만 사용 |
| `--help` | 도움말 |

Ollama 설정은 `backend/ollama_config.json` 에서 읽습니다.

```json
{
  "url": "http://localhost:11434",
  "model": "gemma-4-e4b",
  "systemPrompt": "..."
}
```

Ollama 응답이 실패하면 크롤러는 자동으로 fallback 규칙 기반 정규화 결과를 `backend/data/public/notices.json` 에 저장합니다. 중복 게시물은 `nttNo` 기준으로 제거됩니다.

### 공지 JSON 구조

```json
[
  {
    "id": "notice_624098",
    "nttNo": "624098",
    "title": "...",
    "category": "학사/장학/취업/행사/기타",
    "dept": "컴퓨터공학전공",
    "summary": "...",
    "content": "...",
    "deadline": "06.10",
    "date": "2026-05-27",
    "url": "https://www.kyonggi.ac.kr/...",
    "tags": ["..."],
    "urgent": false,
    "attachments": [
      { "name": "...", "url": "https://www.kyonggi.ac.kr/..." }
    ]
  }
]
```

## 보안

- 비밀번호는 `scrypt` 해시로 저장합니다 (원문 저장 안 함).
- 세션 ID는 HttpOnly 쿠키 (`campuslens_session`) 로만 전달됩니다.

## 문제 해결

- **포트 충돌**: `$env:PORT="3002"; npm start`
- **공지가 비어 보일 때**: `backend/data/public/notices.json` 이 비어 있을 수 있습니다. 서버를 한 번 재시작하면 더미 데이터가 자동 생성됩니다.
- **크롤러에서 Ollama 오류**: `npm run crawl -- --no-ollama` 로 fallback 만 사용.
