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

test("urgent: true는 긴급 공지만 반환", () => {
  const out = filterSources({ dataset: "notices", urgent: true }, NOTICES, RESTAURANTS, new Date(2026, 4, 29));
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "n1");
});

test("MAX_RESULTS 상한 8개 적용", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `m${i}`, title: `공지 ${i}`, category: "학사", dept: "학사팀",
    date: "2026-05-20", deadline: null, url: `http://x/m${i}`,
    summary: "", tags: [], urgent: false,
  }));
  const out = filterSources({ dataset: "notices" }, many, [], new Date(2026, 4, 29));
  assert.equal(out.length, 8);
});
