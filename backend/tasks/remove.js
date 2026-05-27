import { readUserList, writeUserList } from "../services/userStore.js";

export default async function removeTask(req, res, next) {
  try {
    const tasks = await readUserList(req.user.id, "tasks");
    const next = tasks.filter((t) => t.id !== req.params.id);
    if (next.length === tasks.length) {
      res.status(404).json({ error: "TASK_NOT_FOUND", message: "일정을 찾을 수 없습니다." });
      return;
    }
    await writeUserList(req.user.id, "tasks", next);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
