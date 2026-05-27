import {
  createItemId,
  readUserList,
  writeUserList,
} from "../services/userStore.js";

const VALID_DAYS = ["월", "화", "수", "목", "금"];

function validate(body) {
  const errors = [];
  if (!String(body.name || "").trim()) errors.push("과목명을 입력하세요.");
  if (!VALID_DAYS.includes(String(body.day || ""))) errors.push("요일은 월/화/수/목/금 중 하나여야 합니다.");
  if (!/^\d{2}:\d{2}$/.test(String(body.time || ""))) errors.push("시작 시간은 HH:mm 형식이어야 합니다.");
  const n = Number(body.duration);
  if (!Number.isInteger(n) || n < 1 || n > 6) errors.push("강의 시간은 1~6 사이의 정수여야 합니다.");
  return errors;
}

export default async function createClass(req, res, next) {
  try {
    const errors = validate(req.body || {});
    if (errors.length) {
      res.status(400).json({ error: "INVALID_CLASS", message: errors.join(" ") });
      return;
    }
    const now = new Date().toISOString();
    const item = {
      id: createItemId("class"),
      day: String(req.body.day).trim(),
      time: String(req.body.time).trim(),
      duration: Number(req.body.duration),
      name: String(req.body.name).trim(),
      room: String(req.body.room || "").trim(),
      color: String(req.body.color || "").trim(),
      createdAt: now,
      updatedAt: now,
    };
    const classes = await readUserList(req.user.id, "classes");
    classes.push(item);
    await writeUserList(req.user.id, "classes", classes);
    res.status(201).json({ class: item });
  } catch (err) {
    next(err);
  }
}
