/**
 * File: server/services/jsonStore.js
 * Purpose: 서버의 JSON 파일 저장소를 생성, 읽기, 쓰기, 갱신하는 공통 I/O 계층이다.
 * Notes: 데모용 파일 저장소이지만 쓰기 큐와 임시 파일 rename을 사용해 동시 쓰기 손상을 줄인다.
 */

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
  notices: [],
  restaurants: [],
  classes: [],
  "user-classes": []
};

const writeQueues = new Map();

/**
 * assertStoreName
 * 허용된 저장소 이름만 파일 경로로 변환되도록 방어한다.
 *
 * @param {string} name - 검사할 저장소 이름
 */
function assertStoreName(name) {
  if (!Object.hasOwn(storeDefaults, name)) {
    throw new Error(`Unknown JSON store: ${name}`);
  }
}

/**
 * storePath
 * 저장소 이름을 실제 data 디렉터리의 JSON 파일 경로로 변환한다.
 *
 * @param {string} name - 저장소 이름
 * @returns {string} JSON 파일 절대 경로
 */
function storePath(name) {
  assertStoreName(name);
  return path.join(dataDir, `${name}.json`);
}

/**
 * fileExists
 * 파일 접근 가능 여부를 boolean으로 반환한다.
 *
 * @param {string} filePath - 검사할 파일 경로
 * @returns {Promise<boolean>} 파일이 있으면 true
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * withStoreQueue
 * 같은 저장소 파일에 대한 쓰기 작업을 순차 실행해 race condition을 줄인다.
 *
 * @param {string} name - 저장소 이름
 * @param {Function} operation - 큐 안에서 실행할 비동기 작업
 * @returns {Promise<unknown>} operation의 반환값
 */
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

/**
 * createId
 * UUID 앞에 도메인 prefix를 붙여 사람이 읽기 쉬운 id를 생성한다.
 *
 * @param {string} prefix - id prefix
 * @returns {string} prefix_UUID 형식 id
 */
export function createId(prefix = "id") {
  return `${prefix}_${randomUUID()}`;
}

/**
 * ensureStores
 * data 디렉터리와 모든 기본 JSON 파일이 존재하도록 보장한다.
 */
export async function ensureStores() {
  await fs.mkdir(dataDir, { recursive: true });

  await Promise.all(Object.entries(storeDefaults).map(async ([name, value]) => {
    const filePath = storePath(name);
    if (!(await fileExists(filePath))) {
      await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
  }));
}

/**
 * readStore
 * 지정한 JSON 저장소를 읽고 파싱한다.
 *
 * @param {string} name - 저장소 이름
 * @returns {Promise<unknown>} 파싱된 저장소 값
 */
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

/**
 * writeStore
 * 지정한 저장소 전체를 새 값으로 교체한다.
 *
 * @param {string} name - 저장소 이름
 * @param {unknown} value - 저장할 값
 * @returns {Promise<unknown>} 저장된 값
 */
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

/**
 * updateStore
 * 현재 저장소 값을 읽은 뒤 updater 결과로 원자적 쓰기를 수행한다.
 *
 * @param {string} name - 저장소 이름
 * @param {Function} updater - 현재 값을 받아 다음 값을 반환하는 함수
 * @returns {Promise<unknown>} 저장된 최종 값
 */
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
