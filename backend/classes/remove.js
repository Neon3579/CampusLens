import { readUserList, writeUserList } from "../services/userStore.js";

export default async function removeClass(req, res, next) {
  try {
    const classes = await readUserList(req.user.id, "classes");
    const next = classes.filter((c) => c.id !== req.params.id);
    if (next.length === classes.length) {
      res.status(404).json({ error: "CLASS_NOT_FOUND", message: "강의를 찾을 수 없습니다." });
      return;
    }
    await writeUserList(req.user.id, "classes", next);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
