import { readUserList } from "../services/userStore.js";

export default async function getOneTask(req, res, next) {
  try {
    const tasks = await readUserList(req.user.id, "tasks");
    const task = tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: "TASK_NOT_FOUND", message: "일정을 찾을 수 없습니다." });
      return;
    }
    res.json({ task });
  } catch (err) {
    next(err);
  }
}
