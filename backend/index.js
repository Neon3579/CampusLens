import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureSeedData } from "./services/seed.js";
import { requireAuth } from "./middleware/requireAuth.js";

import signup from "./auth/signup.js";
import login from "./auth/login.js";
import logout from "./auth/logout.js";
import me from "./auth/me.js";

import notices from "./public-data/notices.js";
import restaurants from "./public-data/restaurants.js";
import aiQuery from "./ai/query.js";

import getAllTasks from "./tasks/getAll.js";
import createTaskHandler from "./tasks/create.js";
import getOneTask from "./tasks/getOne.js";
import updateTask from "./tasks/update.js";
import removeTask from "./tasks/remove.js";

import getAllClasses from "./classes/getAll.js";
import createClassHandler from "./classes/create.js";
import updateClass from "./classes/update.js";
import removeClass from "./classes/remove.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 3001;

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "CampusLens API", storage: "json-file", time: new Date().toISOString() });
});

app.post("/api/auth/signup", signup);
app.post("/api/auth/login", login);
app.post("/api/auth/logout", logout);
app.get("/api/auth/me", requireAuth, me);

app.get("/api/public-data/notices", notices);
app.get("/api/public-data/restaurants", restaurants);
app.post("/api/ai/query", aiQuery);

app.get("/api/tasks", requireAuth, getAllTasks);
app.post("/api/tasks", requireAuth, createTaskHandler);
app.get("/api/tasks/:id", requireAuth, getOneTask);
app.patch("/api/tasks/:id", requireAuth, updateTask);
app.delete("/api/tasks/:id", requireAuth, removeTask);

app.get("/api/classes", requireAuth, getAllClasses);
app.post("/api/classes", requireAuth, createClassHandler);
app.patch("/api/classes/:id", requireAuth, updateClass);
app.delete("/api/classes/:id", requireAuth, removeClass);

app.use(express.static(FRONTEND_DIR));
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "NOT_FOUND", message: "요청한 API를 찾을 수 없습니다." });
    return;
  }
  res.status(404).send("Not Found");
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.code || "SERVER_ERROR",
    message: err.message || "서버 오류가 발생했습니다.",
  });
});

await ensureSeedData();

app.listen(PORT, HOST, () => {
  console.log(`CampusLens backend listening on http://${HOST}:${PORT}`);
});
