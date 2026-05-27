import { publicUser } from "../services/userStore.js";

export default function me(req, res) {
  res.json({ user: publicUser(req.user) });
}
