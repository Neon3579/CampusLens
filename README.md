# CampusLens

CampusLens는 교내 공지, 학식, 시간표, 과제 일정을 한 화면에서 관리하는 학생용 웹 애플리케이션입니다. 공개 공지 데이터를 JSON으로 정리하고, 사용자가 직접 입력한 일정과 시간표를 계정별로 저장하는 데모 프로젝트입니다.

## 주요 기능

- 교내 공지/대회 목록 조회, 검색, 카테고리 필터
- 공지 상세 모달, 마감 임박 공지 강조
- 식당별 주간 학식 조회 및 날짜 이동
- 기본 시간표 조회, 개인 강의 추가/삭제
- 과제/시험/발표 일정 CRUD
- 회원가입, 로그인, 로그아웃, 세션 유지
- 공개 공지 페이지 크롤링 및 Ollama 기반 공지 정규화
- Ollama 실패 시 규칙 기반 fallback 저장

## 기술 스택

- Frontend: HTML, CSS, Vanilla JavaScript ES Modules
- Backend: Node.js, Express
- Data Store: JSON 파일 기반 로컬 저장소
- Crawler: Cheerio
- LLM Normalization: Ollama `llama3.1`
- Auth: scrypt 비밀번호 해시, Bearer token, HttpOnly cookie

React, Vue, Tailwind, Bootstrap 같은 프론트엔드 프레임워크는 사용하지 않았습니다.

## 프로젝트 구조

```text
CampusLens/
├─ README.md
└─ server/
   ├─ index.js                    # Express 서버 진입점
   ├─ config.js                   # HOST, PORT, CORS, 세션, Ollama 설정
   ├─ main.html                   # 정적 프론트엔드 앱 셸
   ├─ package.json
   ├─ .env.example
   ├─ assets/
   │  ├─ styles.css
   │  └─ js/
   │     ├─ app.js                # 앱 초기화
   │     ├─ api.js                # API 요청 래퍼
   │     ├─ dataService.js        # API 응답을 state로 변환
   │     ├─ renderers.js          # 화면 렌더링
   │     ├─ components.js         # 반복 HTML 템플릿
   │     ├─ events.js             # 이벤트 연결
   │     ├─ state.js              # 프론트엔드 상태
   │     └─ date.js               # 날짜 유틸
   ├─ routes/                     # API 라우터
   ├─ services/                   # 인증, 저장소, 크롤러, Ollama 연동
   ├─ validators/                 # 요청 검증
   ├─ middleware/                 # CORS, 에러 처리
   ├─ scripts/
   │  └─ crawlNotices.js          # 공지 크롤링 CLI
   └─ data/                       # 런타임 JSON 저장소, gitignore 대상

```

## 설치 방법

### 1. Node.js 설치

Node.js `18.17` 이상이 필요합니다.

```powershell
node -v
npm -v
```

### 2. 의존성 설치

프로젝트 루트에서 다음 명령을 실행합니다.

```powershell
cd server
npm install
```

## 실행 방법

### 개발 모드

파일 변경을 감지해 서버를 다시 시작합니다.

```powershell
cd server
npm run dev
```

### 일반 실행

```powershell
cd server
npm start
```

기본 접속 주소는 다음과 같습니다.

```text
http://127.0.0.1:3001
```

서버 상태 확인:

```text
http://127.0.0.1:3001/api/health
```

## 환경변수

기본값이 설정되어 있어서 별도 환경변수 없이 실행할 수 있습니다.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `HOST` | `127.0.0.1` | 서버 바인딩 주소 |
| `PORT` | `3001` | 서버 포트 |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `llama3.1` | 공지 정규화에 사용할 Ollama 모델 |
| `SESSION_COOKIE` | `campuslens_session` | 세션 쿠키 이름 |
| `SESSION_TTL_MS` | 7일 | 세션 만료 시간 |
| `CORS_ORIGINS` | 비어 있음 | 허용할 Origin 목록, 쉼표 구분 |

참고: 현재 프로젝트는 `dotenv`를 사용하지 않습니다. `.env.example`은 참고용이며, 값을 바꾸려면 셸 환경변수로 지정해서 실행하세요.

PowerShell 예시:

```powershell
cd server
$env:PORT="3002"
$env:OLLAMA_MODEL="llama3.1"
npm run dev
```

## 사용 방법

1. 서버를 실행합니다.
2. 브라우저에서 `http://127.0.0.1:3001`에 접속합니다.
3. 상단 내비게이션에서 홈, 공지·대회, 학식, 시간표 화면을 이동합니다.
4. 로그인하지 않아도 공개 공지, 학식, 기본 시간표는 볼 수 있습니다.
5. 회원가입/로그인 후 과제 일정과 개인 시간표를 서버에 저장할 수 있습니다.
6. 비로그인 상태에서 추가한 강의/일정은 현재 브라우저 세션의 임시 데이터로만 동작합니다.

## 공지 크롤링 사용법

공개 공지 페이지에서 링크 후보를 수집하고 `server/data/raw-notices.json`, `server/data/notices.json`을 갱신합니다.

```powershell
cd server
npm run crawl -- --url "https://example.ac.kr/notice" --selector ".board-list a" --limit 20 --fallback
```

옵션:

| 옵션 | 설명 |
|---|---|
| `--url <url>` | 크롤링할 공개 공지 페이지 URL |
| `--selector <css>` | 공지 링크를 찾을 CSS selector, 기본값 `a` |
| `--limit <number>` | 수집할 최대 개수, 기본값 `20` |
| `--model <name>` | Ollama 모델명 |
| `--ollama-url <url>` | Ollama 서버 URL |
| `--fallback` | Ollama 실패 시 규칙 기반 정규화로 저장 |
| `--help` | 도움말 출력 |

Ollama를 사용하려면 로컬 Ollama 서버가 실행 중이어야 합니다.

```powershell
ollama serve
ollama pull llama3.1
```

LLM 없이 데모 데이터만 갱신하려면 `--fallback` 옵션을 사용하면 됩니다.

## API 엔드포인트

정적 페이지(`/`, `/main.html`)와 `/assets` 정적 파일 서빙을 제외하면 API 엔드포인트는 총 17개입니다.

### Health

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/health` | 서버 상태 확인 |

### Auth

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/auth/signup` | 회원가입 및 세션 발급 |
| `POST` | `/api/auth/login` | 로그인 및 세션 발급 |
| `POST` | `/api/auth/logout` | 현재 세션 삭제 |
| `GET` | `/api/auth/me` | 현재 로그인 사용자 조회 |

### Public Data

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/public-data/notices` | 정규화된 공지 목록 조회 |
| `GET` | `/api/public-data/notices/raw` | 크롤링 원본 공지 후보 조회 |
| `GET` | `/api/public-data/restaurants` | 식당별 주간 학식 조회 |
| `GET` | `/api/public-data/classes` | 기본 시간표 조회 |

### Tasks

로그인이 필요한 개인 일정 API입니다.

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/tasks` | 내 일정 목록 조회 |
| `POST` | `/api/tasks` | 일정 생성 |
| `GET` | `/api/tasks/:id` | 단일 일정 조회 |
| `PATCH` | `/api/tasks/:id` | 일정 수정 |
| `DELETE` | `/api/tasks/:id` | 일정 삭제 |

### Classes

로그인이 필요한 개인 시간표 API입니다.

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/classes` | 내 강의 목록 조회 |
| `POST` | `/api/classes` | 강의 생성 |
| `DELETE` | `/api/classes/:id` | 강의 삭제 |

## 데이터 저장 방식

서버는 `server/data/*.json` 파일을 로컬 저장소로 사용합니다. 해당 폴더는 `.gitignore`에 포함되어 있으며, 서버 실행 시 필요한 JSON 파일이 없으면 자동으로 생성됩니다.

주요 저장 파일:

- `users.json`: 사용자 계정
- `sessions.json`: 로그인 세션
- `tasks.json`: 개인 일정
- `classes.json`: 공개 기본 시간표
- `user-classes.json`: 사용자별 개인 시간표
- `restaurants.json`: 학식 데이터
- `notices.json`: 정규화된 공지 데이터
- `raw-notices.json`: 크롤링 원본 후보 데이터

## 보안 관련 메모

- 비밀번호는 원문으로 저장하지 않고 `scrypt` 기반 해시로 저장합니다.
- 세션 토큰은 서버 저장소에 원문이 아니라 SHA-256 해시로 저장합니다.
- 인증은 Bearer token과 HttpOnly cookie를 모두 지원합니다.
- 사용자별 일정과 시간표는 `userId`로 필터링합니다.
- LMS/KUTIS 같은 학교 계정의 ID/비밀번호를 입력받아 크롤링하지 않습니다.
- 공개 데이터와 사용자가 직접 입력한 데이터만 다룹니다.

## 발표 자료

발표용 슬라이드는 다음 파일입니다.

```text
presentation/slides.html
```

슬라이드의 live iframe 미리보기를 보려면 먼저 서버를 실행한 뒤 슬라이드를 브라우저에서 열어야 합니다. 서버가 감지되지 않으면 PNG 캡처 이미지로 fallback됩니다.

## 문제 해결

### 포트가 이미 사용 중일 때

```powershell
$env:PORT="3002"
npm run dev
```

### API가 401을 반환할 때

`/api/tasks`, `/api/classes`는 로그인 후 사용할 수 있습니다. 먼저 회원가입 또는 로그인을 진행하세요.

### 공지 크롤링에서 Ollama 오류가 날 때

Ollama 서버가 실행 중인지 확인하거나 `--fallback` 옵션으로 규칙 기반 정규화를 사용하세요.

```powershell
npm run crawl -- --url "https://example.ac.kr/notice" --fallback
```

## 라이선스

학부 웹프로그래밍/논문대회 제출용 데모 프로젝트입니다. 별도 라이선스는 지정하지 않았습니다.
