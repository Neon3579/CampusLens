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
- 질문에 카테고리 목록의 단어(장학, 취업, 학사, 행사 등)가 나오면 반드시 category에 그 값을 넣어라.
- 질문의 핵심 명사를 keywords 배열에 넣어라(예: "장학 공지" → keywords:["장학"]).
- "이번주"는 7, "다음주"는 7, "마감 임박"은 7처럼 상대 기간은 deadlineWithinDays(정수)로 환산.
- 해당 없는 필드는 null, 키워드 없으면 빈 배열.
- JSON 외 다른 텍스트는 절대 출력하지 말 것.
예시:
질문: "다음주 마감인 장학 공지 알려줘"
출력: {"dataset":"notices","category":"장학","keywords":["장학"],"urgent":null,"deadlineWithinDays":7}`;
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
  const system = `너는 대학 캠퍼스 앱의 도우미다. 아래 "검색 결과"에 있는 항목만 근거로 답한다.
반드시 한국어로만 작성하고, 영어·중국어 등 다른 언어나 번역·메타 설명을 절대 쓰지 말 것.
검색 결과에 없는 내용은 지어내지 말 것. 핵심만 2~4문장으로 요약한다.`;
  const user = `질문: ${question}\n\n검색 결과:\n${list}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
