import express from "express";

import authRouter from "./routes/auth.js";
import tasksRouter from "./routes/tasks.js";
import publicDataRouter from "./routes/publicData.js";
import { ensureStores } from "./services/jsonStore.js";

const app = express();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3001);

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

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
app.use("/api/public-data", publicDataRouter);

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "요청한 API를 찾을 수 없습니다." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.code || "SERVER_ERROR",
    message: err.message || "서버 오류가 발생했습니다."
  });
});

await ensureStores();

app.listen(port, host, () => {
  console.log(`CampusLens API listening on http://${host}:${port}`);
});
