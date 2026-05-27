import { RESTAURANTS_FILE, readJson } from "../services/fileStore.js";

export default async function restaurants(req, res, next) {
  try {
    const list = await readJson(RESTAURANTS_FILE, []);
    res.json({ restaurants: Array.isArray(list) ? list : [] });
  } catch (err) {
    next(err);
  }
}
