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
