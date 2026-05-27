import { readUserList } from "../services/userStore.js";

export default async function getAllClasses(req, res, next) {
  try {
    const classes = await readUserList(req.user.id, "classes");
    res.json({ classes });
  } catch (err) {
    next(err);
  }
}
