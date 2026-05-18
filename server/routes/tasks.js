import { Router } from "express";

import { requireAuth } from "../services/authService.js";
import { createId, readStore, updateStore } from "../services/jsonStore.js";

const router = Router();

router.use(requireAuth);

function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function serializeTask(task) {
  return {
    id: task.id,
    title: task.title,
    course: task.course,
    type: task.type,
    due: task.due,
    time: task.time,
    completed: Boolean(task.completed),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function validateTaskInput(body, partial = false) {
  const errors = [];

  if (!partial || body.title !== undefined) {
    if (!String(body.title || "").trim()) errors.push("제목을 입력하세요.");
  }

  if (!partial || body.due !== undefined) {
    if (!isDateString(body.due)) errors.push("마감일은 YYYY-MM-DD 형식이어야 합니다.");
  }

  if (body.time && !/^\d{2}:\d{2}$/.test(String(body.time))) {
    errors.push("시간은 HH:mm 형식이어야 합니다.");
  }

  return errors;
}

router.get("/", async (req, res, next) => {
  try {
    const tasks = await readStore("tasks");
    const userTasks = tasks
      .filter(task => task.userId === req.user.id)
      .sort((a, b) => `${a.due} ${a.time || "23:59"}`.localeCompare(`${b.due} ${b.time || "23:59"}`))
      .map(serializeTask);

    res.json({ tasks: userTasks });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validateTaskInput(req.body || {});
    if (errors.length) {
      res.status(400).json({ error: "INVALID_TASK", message: errors.join(" ") });
      return;
    }

    const now = new Date().toISOString();
    const task = {
      id: createId("task"),
      userId: req.user.id,
      title: String(req.body.title).trim(),
      course: String(req.body.course || "").trim(),
      type: String(req.body.type || "일정").trim(),
      due: String(req.body.due).trim(),
      time: String(req.body.time || "").trim(),
      completed: Boolean(req.body.completed),
      createdAt: now,
      updatedAt: now
    };

    await updateStore("tasks", tasks => [...tasks, task]);
    res.status(201).json({ task: serializeTask(task) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const tasks = await readStore("tasks");
    const task = tasks.find(item => item.id === req.params.id && item.userId === req.user.id);

    if (!task) {
      res.status(404).json({ error: "TASK_NOT_FOUND", message: "일정을 찾을 수 없습니다." });
      return;
    }

    res.json({ task: serializeTask(task) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const errors = validateTaskInput(req.body || {}, true);
    if (errors.length) {
      res.status(400).json({ error: "INVALID_TASK", message: errors.join(" ") });
      return;
    }

    let updatedTask = null;
    await updateStore("tasks", tasks => tasks.map(task => {
      if (task.id !== req.params.id || task.userId !== req.user.id) return task;

      updatedTask = {
        ...task,
        title: req.body.title === undefined ? task.title : String(req.body.title).trim(),
        course: req.body.course === undefined ? task.course : String(req.body.course || "").trim(),
        type: req.body.type === undefined ? task.type : String(req.body.type || "일정").trim(),
        due: req.body.due === undefined ? task.due : String(req.body.due).trim(),
        time: req.body.time === undefined ? task.time : String(req.body.time || "").trim(),
        completed: req.body.completed === undefined ? task.completed : Boolean(req.body.completed),
        updatedAt: new Date().toISOString()
      };

      return updatedTask;
    }));

    if (!updatedTask) {
      res.status(404).json({ error: "TASK_NOT_FOUND", message: "일정을 찾을 수 없습니다." });
      return;
    }

    res.json({ task: serializeTask(updatedTask) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    let deleted = false;
    await updateStore("tasks", tasks => tasks.filter(task => {
      const keep = !(task.id === req.params.id && task.userId === req.user.id);
      if (!keep) deleted = true;
      return keep;
    }));

    if (!deleted) {
      res.status(404).json({ error: "TASK_NOT_FOUND", message: "일정을 찾을 수 없습니다." });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
