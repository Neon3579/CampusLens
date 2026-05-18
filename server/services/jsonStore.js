import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");

const storeDefaults = {
  users: [],
  sessions: [],
  tasks: [],
  "raw-notices": [],
  notices: []
};

const writeQueues = new Map();

function assertStoreName(name) {
  if (!Object.hasOwn(storeDefaults, name)) {
    throw new Error(`Unknown JSON store: ${name}`);
  }
}

function storePath(name) {
  assertStoreName(name);
  return path.join(dataDir, `${name}.json`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function withStoreQueue(name, operation) {
  const previous = writeQueues.get(name) || Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const tracked = current.finally(() => {
    if (writeQueues.get(name) === tracked) {
      writeQueues.delete(name);
    }
  });
  writeQueues.set(name, tracked);
  return current;
}

export function createId(prefix = "id") {
  return `${prefix}_${randomUUID()}`;
}

export async function ensureStores() {
  await fs.mkdir(dataDir, { recursive: true });

  await Promise.all(Object.entries(storeDefaults).map(async ([name, value]) => {
    const filePath = storePath(name);
    if (!(await fileExists(filePath))) {
      await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
  }));
}

export async function readStore(name) {
  await ensureStores();
  const filePath = storePath(name);
  const raw = await fs.readFile(filePath, "utf8");

  try {
    return JSON.parse(raw || "null") ?? structuredClone(storeDefaults[name]);
  } catch (error) {
    error.message = `${name}.json 파싱에 실패했습니다: ${error.message}`;
    throw error;
  }
}

export async function writeStore(name, value) {
  return withStoreQueue(name, async () => {
    await ensureStores();
    const filePath = storePath(name);
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, filePath);
    return value;
  });
}

export async function updateStore(name, updater) {
  return withStoreQueue(name, async () => {
    await ensureStores();
    const current = await readStore(name);
    const next = await updater(current);
    const value = next === undefined ? current : next;
    const filePath = storePath(name);
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, filePath);
    return value;
  });
}
