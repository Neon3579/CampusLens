import { readUserList, writeUserList } from "../services/userStore.js";

const VALID_DAYS = ["월", "화", "수", "목", "금"];

function validatePatch(body) {
  const errors = [];
  if (body.name !== undefined && !String(body.name).trim()) errors.push("과목명을 입력하세요.");
  if (body.day !== undefined && !VALID_DAYS.includes(String(body.day))) errors.push("요일은 월/화/수/목/금 중 하나여야 합니다.");
  if (body.time !== undefined && !/^\d{2}:\d{2}$/.test(String(body.time))) errors.push("시작 시간은 HH:mm 형식이어야 합니다.");
  if (body.duration !== undefined) {
    const n = Number(body.duration);
    if (!Number.isInteger(n) || n < 1 || n > 6) errors.push("강의 시간은 1~6 사이의 정수여야 합니다.");
  }
  return errors;
}

export default async function updateClass(req, res, next) {
  try {
    const errors = validatePatch(req.body || {});
    if (errors.length) {
      res.status(400).json({ error: "INVALID_CLASS", message: errors.join(" ") });
      return;
    }
    const classes = await readUserList(req.user.id, "classes");
    const index = classes.findIndex((c) => c.id === req.params.id);
    if (index < 0) {
      res.status(404).json({ error: "CLASS_NOT_FOUND", message: "강의를 찾을 수 없습니다." });
      return;
    }
    const body = req.body || {};
    const current = classes[index];
    const updated = {
      ...current,
      day: body.day === undefined ? current.day : String(body.day).trim(),
      time: body.time === undefined ? current.time : String(body.time).trim(),
      duration: body.duration === undefined ? current.duration : Number(body.duration),
      name: body.name === undefined ? current.name : String(body.name).trim(),
      room: body.room === undefined ? current.room : String(body.room || "").trim(),
      color: body.color === undefined ? current.color : String(body.color || "").trim(),
      updatedAt: new Date().toISOString(),
    };
    classes[index] = updated;
    await writeUserList(req.user.id, "classes", classes);
    res.json({ class: updated });
  } catch (err) {
    next(err);
  }
}
