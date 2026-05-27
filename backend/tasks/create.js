import {
  createItemId,
  readUserList,
  writeUserList,
} from "../services/userStore.js";

function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function validate(body) {
  const errors = [];
  if (!String(body.title || "").trim()) errors.push("제목을 입력하세요.");
  if (!isDateString(body.due)) errors.push("마감일은 YYYY-MM-DD 형식이어야 합니다.");
  if (body.time && !/^\d{2}:\d{2}$/.test(String(body.time))) {
    errors.push("시간은 HH:mm 형식이어야 합니다.");
  }
  return errors;
}

export default async function createTask(req, res, next) {
  try {
    const errors = validate(req.body || {});
    if (errors.length) {
      res.status(400).json({ error: "INVALID_TASK", message: errors.join(" ") });
      return;
    }
    const now = new Date().toISOString();
    const task = {
      id: createItemId("task"),
      title: String(req.body.title).trim(),
      course: String(req.body.course || "").trim(),
      type: String(req.body.type || "과제").trim(),
      due: String(req.body.due).trim(),
      time: String(req.body.time || "").trim(),
      completed: Boolean(req.body.completed),
      createdAt: now,
      updatedAt: now,
    };
    const tasks = await readUserList(req.user.id, "tasks");
    tasks.push(task);
    await writeUserList(req.user.id, "tasks", tasks);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}
