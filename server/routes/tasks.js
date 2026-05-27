/**
 * File: server/routes/tasks.js
 * Purpose: 로그인 사용자의 과제/시험/발표 일정 CRUD API를 정의한다.
 * Notes: 모든 라우트는 requireAuth 이후에 실행되어 사용자별 데이터 격리를 보장한다.
 */

import { Router } from "express";

import { requireAuth } from "../services/authService.js";
import { createId, readStore, updateStore } from "../services/jsonStore.js";
import { validateTaskInput } from "../validators/taskValidator.js";

const router = Router();

router.use(requireAuth);

/**
 * serializeTask
 * 저장소의 task 객체에서 클라이언트에 노출할 필드만 골라 반환한다.
 *
 * @param {object} task - 저장소 일정 객체
 * @returns {object} API 응답용 일정 객체
 */
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

/**
 * GET /api/tasks
 * 현재 사용자의 일정을 마감일/시간 순으로 정렬해 반환한다.
 */
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

/**
 * POST /api/tasks
 * 현재 사용자에게 귀속되는 새 일정을 생성한다.
 */
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

/**
 * GET /api/tasks/:id
 * 현재 사용자의 단일 일정을 조회한다.
 */
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

/**
 * PATCH /api/tasks/:id
 * 현재 사용자의 일정 일부 필드를 수정한다.
 */
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

/**
 * DELETE /api/tasks/:id
 * 현재 사용자의 일정을 삭제한다.
 */
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
