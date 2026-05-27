/**
 * File: server/scripts/crawlNotices.js
 * Purpose: 공개 공지 페이지를 크롤링하고 Ollama 또는 fallback 정규화로 notices.json을 갱신하는 CLI 스크립트다.
 * Notes: npm run crawl -- --url <url> 형태로 실행되며 raw-notices.json과 notices.json을 함께 갱신한다.
 */

import { crawlPublicNotices } from "../services/crawler.js";
import { fallbackNormalizeNotices, normalizeNoticesWithOllama } from "../services/ollama.js";
import { writeStore } from "../services/jsonStore.js";

/**
 * parseArgs
 * CLI 인자를 key/value 옵션 객체로 변환한다.
 *
 * @param {Array<string>} argv - process.argv.slice(2) 형태의 인자 배열
 * @returns {object} 크롤링과 정규화 옵션
 */
function parseArgs(argv) {
  const args = {
    selector: "a",
    limit: 20,
    fallback: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--fallback") {
      args.fallback = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`--${key} 옵션 값이 필요합니다.`);
    }

    args[key] = value;
    i += 1;
  }

  args.limit = Number(args.limit) || 20;
  return args;
}

/**
 * printHelp
 * 사용자가 필요한 옵션을 빠르게 확인할 수 있도록 CLI 도움말을 출력한다.
 */
function printHelp() {
  console.log(`
CampusLens public notice crawler

Usage:
  npm run crawl -- --url <public-notice-url> [options]

Options:
  --url <url>          크롤링할 공개 공지 페이지 URL
  --selector <css>     공지 링크를 찾을 CSS selector, 기본값: a
  --limit <number>     수집할 최대 항목 수, 기본값: 20
  --model <name>       Ollama 모델명, 기본값: OLLAMA_MODEL 또는 llama3.1
  --ollama-url <url>   Ollama 서버 URL, 기본값: OLLAMA_URL 또는 http://localhost:11434
  --fallback           Ollama 실패 시 단순 규칙 기반 정규화로 저장
  --help               도움말 출력

Example:
  npm run crawl -- --url https://example.ac.kr/notice --selector ".board-list a" --limit 20 --fallback
`.trim());
}

/**
 * main
 * 인자 파싱, 크롤링, raw 저장, Ollama 정규화, fallback 처리, 최종 저장을 순서대로 실행한다.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.url) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  console.log(`[crawl] fetching ${args.url}`);
  const rawItems = await crawlPublicNotices({
    url: args.url,
    selector: args.selector,
    limit: args.limit
  });
  await writeStore("raw-notices", rawItems);
  console.log(`[crawl] saved ${rawItems.length} raw items to data/raw-notices.json`);

  let notices;
  let usedFallback = false;

  try {
    console.log(`[ollama] normalizing with ${args.model || process.env.OLLAMA_MODEL || "llama3.1"}`);
    notices = await normalizeNoticesWithOllama(rawItems, {
      model: args.model,
      ollamaUrl: args["ollama-url"]
    });
  } catch (error) {
    if (!args.fallback) {
      throw error;
    }

    usedFallback = true;
    console.warn(`[ollama] failed: ${error.message}`);
    console.warn("[fallback] saving rule-based normalized notices");
    notices = fallbackNormalizeNotices(rawItems);
  }

  await writeStore("notices", notices);

  console.log(JSON.stringify({
    ok: true,
    rawCount: rawItems.length,
    count: notices.length,
    fallback: usedFallback,
    output: {
      raw: "data/raw-notices.json",
      notices: "data/notices.json"
    }
  }, null, 2));
}

main().catch(error => {
  console.error(`[error] ${error.message}`);
  process.exitCode = 1;
});
