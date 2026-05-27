import { readUserList } from "../services/userStore.js";

export default async function getAllTasks(req, res, next) {
  try {
    const tasks = await readUserList(req.user.id, "tasks");
    const sorted = tasks
      .slice()
      .sort((a, b) => `${a.due} ${a.time || "23:59"}`.localeCompare(`${b.due} ${b.time || "23:59"}`));
    res.json({ tasks: sorted });
  } catch (err) {
    next(err);
  }
}
