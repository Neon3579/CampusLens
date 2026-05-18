import { Router } from "express";

import { readStore } from "../services/jsonStore.js";

const router = Router();

router.get("/notices", async (req, res, next) => {
  try {
    const notices = await readStore("notices");
    res.json({ notices });
  } catch (error) {
    next(error);
  }
});

router.get("/notices/raw", async (req, res, next) => {
  try {
    const notices = await readStore("raw-notices");
    res.json({ notices });
  } catch (error) {
    next(error);
  }
});

export default router;
