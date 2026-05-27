import { NOTICES_FILE, readJson } from "../services/fileStore.js";

export default async function notices(req, res, next) {
  try {
    const list = await readJson(NOTICES_FILE, []);
    res.json({ notices: Array.isArray(list) ? list : [] });
  } catch (err) {
    next(err);
  }
}
