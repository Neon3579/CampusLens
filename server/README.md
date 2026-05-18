# CampusLens Local API

Node.js + Express + JSON 파일 저장소로 만든 CampusLens 시연용 로컬 백엔드입니다.

## 실행

```bash
cd server
npm install
npm run dev
```

서버 기본 주소는 `http://localhost:3001`입니다.

Ollama 정규화를 쓰려면 별도 터미널에서 Ollama를 실행하고 사용할 모델을 받아 둡니다.

```bash
ollama serve
ollama pull llama3.1
```

환경 변수는 필요하면 `.env.example`을 참고해 터미널에서 지정하세요.

```bash
PORT=3001 OLLAMA_MODEL=llama3.1 npm run dev
```

## 수동 크롤링

크롤링과 Ollama 정규화는 API 서버에서 실행하지 않습니다. 발표 때는 서버와 별개로 아래 명령을 직접 실행하면 됩니다.

```bash
cd server
npm run crawl -- --url "https://example.ac.kr/notice" --selector "a" --limit 20 --fallback
```

동작 흐름은 다음과 같습니다.

```text
공개 공지 페이지 크롤링
  -> data/raw-notices.json 저장
  -> Ollama API로 정규화
  -> data/notices.json 저장
  -> API 서버가 GET /api/public-data/notices로 제공
```

사용 가능한 옵션:

```bash
npm run crawl -- \
  --url "https://example.ac.kr/notice" \
  --selector ".board-list a" \
  --limit 20 \
  --model "llama3.1" \
  --fallback
```

`--fallback`은 Ollama가 꺼져 있거나 모델 응답에 실패했을 때 단순 규칙 기반 데이터라도 저장하게 하는 발표용 안전장치입니다.

## 주요 API

### 상태 확인

```http
GET /api/health
```

### 회원가입

```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "123456",
  "name": "홍길동"
}
```

### 로그인

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "123456"
}
```

응답의 `token`은 `Authorization: Bearer <token>` 헤더로 보낼 수 있고, 브라우저에서는 HttpOnly 쿠키도 같이 설정됩니다.

### 내 정보

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 사용자 일정

```http
GET /api/tasks
Authorization: Bearer <token>
```

```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "학술대회 논문 초안 제출",
  "course": "웹프로그래밍",
  "type": "과제",
  "due": "2026-05-31",
  "time": "23:59"
}
```

```http
PATCH /api/tasks/task_id
DELETE /api/tasks/task_id
```

### 저장된 공개 공지

```http
GET /api/public-data/notices
GET /api/public-data/notices/raw
```

## JSON 저장소

데이터는 `server/data/*.json`에 저장됩니다.

- `users.json`: 가입 사용자
- `sessions.json`: 로그인 세션
- `tasks.json`: 사용자 일정
- `raw-notices.json`: 크롤링 원본 후보
- `notices.json`: Ollama로 정규화한 공개 공지
