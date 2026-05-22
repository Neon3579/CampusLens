/**
 * File: server/index.js
 * Purpose: CampusLens Express 앱의 진입점으로 정적 프론트엔드, API 라우터, 공통 미들웨어를 연결한다.
 * Notes: 서버 시작 전 JSON 저장소 파일을 보장하고, 정적 SPA와 REST API를 같은 origin에서 제공한다.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import authRouter from "./routes/auth.js";
import tasksRouter from "./routes/tasks.js";
import classesRouter from "./routes/classes.js";
import publicDataRouter from "./routes/publicData.js";
import { config } from "./config.js";
import { corsHandler } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.js";
import { ensureStores } from "./services/jsonStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(corsHandler);

/**
 * GET /api/health
 * 서버 프로세스와 JSON 저장소 기반 실행 상태를 확인하기 위한 간단한 헬스 체크 엔드포인트다.
 */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "CampusLens API",
    storage: "json",
    time: new Date().toISOString()
  });
});

app.use("/api/auth", authRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/classes", classesRouter);
app.use("/api/public-data", publicDataRouter);

/**
 * GET /
 * 앱 루트 접근 시 정적 프론트엔드 HTML을 반환한다.
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "main.html"));
});

/**
 * GET /main.html
 * 명시적으로 main.html을 요청하는 브라우저와 개발 도구를 위한 정적 HTML 응답이다.
 */
app.get("/main.html", (req, res) => {
  res.sendFile(path.join(__dirname, "main.html"));
});

app.use(notFoundHandler);
app.use(errorHandler);

await ensureStores();

app.listen(config.port, config.host, () => {
  console.log(`CampusLens API listening on http://${config.host}:${config.port}`);
});
