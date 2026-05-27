import { readUserList, writeUserList } from "../services/userStore.js";

function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function validatePatch(body) {
  const errors = [];
  if (body.title !== undefined && !String(body.title || "").trim()) errors.push("제목을 입력하세요.");
  if (body.due !== undefined && !isDateString(body.due)) errors.push("마감일은 YYYY-MM-DD 형식이어야 합니다.");
  if (body.time !== undefined && body.time && !/^\d{2}:\d{2}$/.test(String(body.time))) {
    errors.push("시간은 HH:mm 형식이어야 합니다.");
  }
  return errors;
}

export default async function updateTask(req, res, next) {
  try {
    const errors = validatePatch(req.body || {});
    if (errors.length) {
      res.status(400).json({ error: "INVALID_TASK", message: errors.join(" ") });
      return;
    }
    const tasks = await readUserList(req.user.id, "tasks");
    const index = tasks.findIndex((t) => t.id === req.params.id);
    if (index < 0) {
      res.status(404).json({ error: "TASK_NOT_FOUND", message: "일정을 찾을 수 없습니다." });
      return;
    }
    const body = req.body || {};
    const current = tasks[index];
    const updated = {
      ...current,
      title: body.title === undefined ? current.title : String(body.title).trim(),
      course: body.course === undefined ? current.course : String(body.course || "").trim(),
      type: body.type === undefined ? current.type : String(body.type || "과제").trim(),
      due: body.due === undefined ? current.due : String(body.due).trim(),
      time: body.time === undefined ? current.time : String(body.time || "").trim(),
      completed: body.completed === undefined ? current.completed : Boolean(body.completed),
      updatedAt: new Date().toISOString(),
    };
    tasks[index] = updated;
    await writeUserList(req.user.id, "tasks", tasks);
    res.json({ task: updated });
  } catch (err) {
    next(err);
  }
}
