import fs from "node:fs/promises";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import {
  DATA_DIR,
  USER_DIR,
  ensureDir,
  readJson,
  writeJson,
  userDir,
  userFile,
} from "./fileStore.js";

export function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedHash] = String(passwordHash).split(":");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;
  const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

async function listUserIds() {
  await ensureDir(USER_DIR);
  const entries = await fs.readdir(USER_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  const ids = await listUserIds();
  for (const id of ids) {
    const info = await readJson(userFile(id, "info"), null);
    if (info && info.email === normalized) return info;
  }
  return null;
}

export async function findUserById(id) {
  if (!id) return null;
  return readJson(userFile(id, "info"), null);
}

export async function createUser({ email, password, name }) {
  const normalized = normalizeEmail(email);
  const id = `user_${randomUUID()}`;
  const now = new Date().toISOString();
  const user = {
    id,
    email: normalized,
    name: String(name).trim(),
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  await ensureDir(userDir(id));
  await writeJson(userFile(id, "info"), user);
  await writeJson(userFile(id, "tasks"), []);
  await writeJson(userFile(id, "classes"), []);
  return user;
}

export async function readUserList(userId, kind) {
  return readJson(userFile(userId, kind), []);
}

export async function writeUserList(userId, kind, value) {
  await ensureDir(userDir(userId));
  return writeJson(userFile(userId, kind), Array.isArray(value) ? value : []);
}

export function createItemId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export { DATA_DIR };
