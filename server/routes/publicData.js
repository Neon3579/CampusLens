/**
 * File: server/routes/publicData.js
 * Purpose: 로그인 없이 조회 가능한 공지, raw 공지, 학식, 기본 시간표 데이터를 제공한다.
 * Notes: 공개 데이터는 JSON 저장소에서 읽기만 수행하며 사용자별 인증 상태와 독립적으로 동작한다.
 */

import { Router } from "express";

import { readStore } from "../services/jsonStore.js";

const router = Router();

/**
 * GET /api/public-data/notices
 * 앱 카드 렌더링에 쓰는 정규화된 공지 목록을 반환한다.
 */
router.get("/notices", async (req, res, next) => {
  try {
    const notices = await readStore("notices");
    res.json({ notices });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public-data/notices/raw
 * 크롤러가 저장한 원본 공지 후보 데이터를 반환한다.
 */
router.get("/notices/raw", async (req, res, next) => {
  try {
    const notices = await readStore("raw-notices");
    res.json({ notices });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public-data/restaurants
 * 식당별 주간 학식 데이터를 반환한다.
 */
router.get("/restaurants", async (req, res, next) => {
  try {
    const restaurants = await readStore("restaurants");
    res.json({ restaurants });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public-data/classes
 * 비로그인 또는 기본 표시용 공개 시간표 데이터를 반환한다.
 */
router.get("/classes", async (req, res, next) => {
  try {
    const classes = await readStore("classes");
    res.json({ classes });
  } catch (error) {
    next(error);
  }
});

export default router;
