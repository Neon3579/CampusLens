/**
 * File: server/routes/classes.js
 * Purpose: 로그인 사용자의 개인 시간표 강의 목록, 생성, 삭제 API를 정의한다.
 * Notes: 공개 기본 시간표는 publicData 라우터가 담당하고, 이 라우터는 사용자별 저장 데이터만 다룬다.
 */

import { Router } from "express";

import { requireAuth } from "../services/authService.js";
import { createId, readStore, updateStore } from "../services/jsonStore.js";
import { validateClassInput } from "../validators/classValidator.js";

const router = Router();

router.use(requireAuth);

/**
 * serializeClass
 * 저장소 강의 객체에서 클라이언트 응답에 필요한 필드만 반환한다.
 *
 * @param {object} item - 저장소 강의 객체
 * @returns {object} API 응답용 강의 객체
 */
function serializeClass(item) {
  return {
    id: item.id,
    day: item.day,
    time: item.time,
    duration: item.duration,
    name: item.name,
    room: item.room,
    color: item.color || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

/**
 * GET /api/classes
 * 현재 사용자의 개인 시간표 강의 목록을 반환한다.
 */
router.get("/", async (req, res, next) => {
  try {
    const classes = await readStore("user-classes");
    const userClasses = classes
      .filter(c => c.userId === req.user.id)
      .map(serializeClass);

    res.json({ classes: userClasses });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/classes
 * 현재 사용자에게 귀속되는 새 강의 블록을 생성한다.
 */
router.post("/", async (req, res, next) => {
  try {
    const errors = validateClassInput(req.body || {});
    if (errors.length) {
      res.status(400).json({ error: "INVALID_CLASS", message: errors.join(" ") });
      return;
    }

    const now = new Date().toISOString();
    const item = {
      id: createId("class"),
      userId: req.user.id,
      day: String(req.body.day).trim(),
      time: String(req.body.time).trim(),
      duration: Number(req.body.duration),
      name: String(req.body.name).trim(),
      room: String(req.body.room || "").trim(),
      color: String(req.body.color || "").trim(),
      createdAt: now,
      updatedAt: now
    };

    await updateStore("user-classes", classes => [...classes, item]);
    res.status(201).json({ class: serializeClass(item) });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/classes/:id
 * 현재 사용자의 개인 강의 블록을 삭제한다.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    let deleted = false;
    await updateStore("user-classes", classes => classes.filter(item => {
      const keep = !(item.id === req.params.id && item.userId === req.user.id);
      if (!keep) deleted = true;
      return keep;
    }));

    if (!deleted) {
      res.status(404).json({ error: "CLASS_NOT_FOUND", message: "강의를 찾을 수 없습니다." });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
