import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.resolve(__dirname, "../data");
export const PUBLIC_DIR = path.join(DATA_DIR, "public");
export const USER_DIR = path.join(DATA_DIR, "user");
export const SESSION_FILE = path.join(DATA_DIR, "session.json");
export const NOTICES_FILE = path.join(PUBLIC_DIR, "notices.json");
export const RESTAURANTS_FILE = path.join(PUBLIC_DIR, "restaurants.json");

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw || "null") ?? fallback;
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
  return value;
}

export async function writeJsonIfMissing(filePath, value) {
  if (await fileExists(filePath)) return false;
  await writeJson(filePath, value);
  return true;
}

export function userDir(userId) {
  return path.join(USER_DIR, String(userId));
}

export function userFile(userId, name) {
  return path.join(userDir(userId), `${name}.json`);
}
